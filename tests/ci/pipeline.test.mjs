import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
import { integrationEnvironment } from '../../scripts/ci/environment.mjs';
import { integrationScripts } from '../integration/manifest.mjs';
import { sanitizedFindings } from '../../scripts/ci/secret-report.mjs';
import { cleanTestEnvironment } from '../test-process.mjs';
const file = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const workflow = parse(file('.github/workflows/ci.yml'));
test('CI remains manual and read-only, with immutable actions/image and no provider secrets', () => {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.doesNotMatch(
    file('.github/workflows/ci.yml'),
    /pull_request_target|secrets\.|id-token:|vercel|git push|db:migrate/,
  );
  assert.deepEqual(Object.keys(workflow.jobs).sort(), [
    'build',
    'contracts',
    'integration',
    'quality',
    'security',
    'unit',
  ]);
  for (const job of Object.values(workflow.jobs)) {
    assert.equal(job['runs-on'], 'ubuntu-24.04');
    assert.ok(job['timeout-minutes'] <= 20);
    const steps = job.steps;
    assert.ok(steps.some((s) => s.run === 'npm ci --ignore-scripts --no-audit --no-fund'));
    for (const step of steps.filter((s) => s.uses)) {
      assert.match(step.uses, /^actions\/[\w-]+@[a-f0-9]{40}$/);
      if (step.uses.startsWith('actions/checkout'))
        assert.equal(step.with['persist-credentials'], false);
    }
  }
  assert.match(
    workflow.jobs.integration.services.postgres.image,
    /^postgres:18\.0-alpine@sha256:[a-f0-9]{64}$/,
  );
  assert.equal(workflow.jobs.security.steps[0].with['fetch-depth'], 0);
  assert.ok(workflow.jobs.build.steps.some((s) => s.run === 'npm run test:security:build'));
});
test('CI rejects remote targets, host overrides and inherited application credentials before SQL', () => {
  for (const CI_DATABASE_URL of [
    '',
    'postgres://db.example.test/postgres',
    'postgres://localhost/normal_app',
    'postgres://localhost/postgres?host=remote.invalid',
  ]) {
    assert.throws(() => integrationEnvironment({ CI_DATABASE_URL }));
  }
  const input = { CI_DATABASE_URL: 'postgres://ci:fictitious@127.0.0.1:55431/postgres' };
  for (const key of [
    'DATABASE_URL',
    'GRAPH_CLIENT_SECRET',
    'AUTH_SECRET',
    'VERCEL',
    'SHAREPOINT_PHOTO_FOLDER_ID',
  ]) {
    assert.throws(() => integrationEnvironment({ ...input, [key]: 'forbidden' }));
  }
  const output = integrationEnvironment(input);
  assert.equal(output.ASVO_DEMO, '1');
  assert.equal(output.APP_URL, 'http://localhost:3031');
  assert.equal(output.DATABASE_URL, input.CI_DATABASE_URL);
  assert.ok(!Object.keys(output).some((k) => /^(AUTH_|GRAPH_|SHAREPOINT_)/.test(k)));
  assert.doesNotMatch(
    file('scripts/ci/integration.mjs') + file('scripts/ci/environment.mjs'),
    /loadEnvFile|--env-file/,
  );
});
test('lockfile/package manifest and exact tooling versions agree; migrations retain checksums', () => {
  const pkg = JSON.parse(file('package.json')),
    lock = JSON.parse(file('package-lock.json'));
  for (const key of ['dependencies', 'devDependencies'])
    assert.deepEqual(lock.packages[''][key], pkg[key]);
  const runtime = JSON.parse(file('scripts/ci/runtime.json'));
  assert.equal(file('.node-version').trim(), runtime.node);
  assert.equal(pkg.packageManager, 'npm@' + runtime.npm);
  assert.equal(pkg.engines, undefined, 'CI must not impose an unsupported production Node engine');
  for (const name of [
    '@biomejs/biome',
    'prettier',
    'yaml',
    'secretlint',
    '@secretlint/secretlint-rule-preset-recommend',
  ])
    assert.match(pkg.devDependencies[name], /^\d+\.\d+\.\d+$/);
  for (const entry of Object.values(lock.packages).filter((e) => e.resolved)) {
    assert.match(entry.resolved, /^https:\/\/registry\.npmjs\.org\//);
    assert.match(entry.integrity, /^sha512-/);
  }
  const manifest = JSON.parse(file('migrations/0001_initial.schema.json'));
  assert.equal(
    manifest.sourceChecksum,
    createHash('sha256').update(file('migrations/0001_initial.sql')).digest('hex'),
  );
});
test('secret scan detects synthetic credential, keeps fixture exception narrow and masks values', () => {
  const synthetic = [
    'postgres:',
    '//ci_scan_823:',
    'credential_482@',
    'db.invalid/disposable',
  ].join('');
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/secretlint/bin/secretlint.js',
      '--format',
      'json',
      '--stdinFileName=ci-synthetic.txt',
    ],
    { input: synthetic, encoding: 'utf8', env: cleanTestEnvironment() },
  );
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.ok(
    report.some((r) =>
      r.messages.some((m) => m.ruleId === '@secretlint/secretlint-rule-database-connection-string'),
    ),
  );
  assert.ok(
    !JSON.stringify(sanitizedFindings(report, '/')).includes(synthetic),
    'Wrapper must remove original source/message from logs',
  );
  const allow = JSON.parse(file('.secretlintrc.json')).rules[0].rules;
  assert.equal(allow.length, 1);
  assert.equal(allow[0].options.allows.length, 3);
  assert.ok(
    allow[0].options.allows.every(
      (value) => value.startsWith('postgres://') && !value.includes('.*'),
    ),
  );
});

test('CI keeps contracts and SQL suites separate while preserving the complete integration manifest', () => {
  assert.match(file('scripts/ci/integration.mjs'), /--skip-contracts/);
  const names = integrationScripts.map((item) => item.name);
  for (const required of [
    'schema-migrations',
    'db-commands',
    'functional-actions',
    'authorization',
    'security',
    'registration',
    'public-registration',
    'workflow-transitions',
    'photo-uploads',
    'mail-outcomes',
    'outing-forms',
    'registry-forms',
  ])
    assert.ok(names.includes(required));
  assert.equal(new Set(names).size, names.length);
  assert.ok(
    !Object.values(workflow.jobs).some((job) =>
      job.steps.some((step) => step.run?.includes('browser.mjs')),
    ),
    'CUA must not be presented as autonomous CI',
  );
});

test('build guard exposes forbidden effects even when the caller catches errors', () => {
  const code =
    "import net from 'node:net';try{await fetch('https://provider.invalid')}catch{};try{net.createConnection({host:'127.0.0.1',port:1})}catch{};";
  const result = spawnSync(
    process.execPath,
    ['--import', './tests/db-commands/no-network.mjs', '--input-type=module', '-e', code],
    { encoding: 'utf8', env: cleanTestEnvironment() },
  );
  assert.equal(result.status, 0);
  assert.match(result.stderr, /\[test-network-blocked\]/);
  assert.match(result.stderr, /\[test-database-blocked\]/);
});
