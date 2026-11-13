import { mkdtemp, cp, rm, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanTestEnvironment } from '../../tests/test-process.mjs';
const directory = await mkdtemp(join(tmpdir(), 'asvo-ci-install-'));
try {
  for (const file of ['package.json', 'package-lock.json'])
    await cp(new URL('../../' + file, import.meta.url), join(directory, file));
  await writeFile(join(directory, 'empty.npmrc'), '');
  const env = {
    ...cleanTestEnvironment(),
    NPM_CONFIG_USERCONFIG: join(directory, 'empty.npmrc'),
    NPM_CONFIG_GLOBALCONFIG: '/dev/null',
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const install = spawnSync(
    'npm',
    ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org'],
    { cwd: directory, env, stdio: 'inherit', timeout: 180_000 },
  );
  if (install.error || install.status !== 0) throw Error('Falló instalación limpia de lockfile.');
  const smoke = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import sharp from 'sharp';await sharp({create:{width:1,height:1,channels:3,background:'white'}}).webp().toBuffer();",
    ],
    { cwd: directory, env, stdio: 'inherit' },
  );
  if (smoke.status !== 0) throw Error('Falló comprobación del módulo nativo sharp.');
  const original = await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8');
  if (original !== (await readFile(join(directory, 'package-lock.json'), 'utf8')))
    throw Error('npm ci modificó el lockfile.');
  for (const name of ['app', 'lib', 'public', 'tsconfig.json', 'next.config.ts']) {
    await cp(new URL('../../' + name, import.meta.url), join(directory, name), { recursive: true });
  }
  const buildEnv = {
    ...env,
    ASVO_DEMO: '0',
    APP_URL: 'https://example.test',
    DATABASE_URL: 'postgres://fictitious:fictitious@127.0.0.1:1/no_connection',
    AUTH_SECRET: 'fictitious-build-key-with-at-least-32-characters',
    AUTH_MICROSOFT_ENTRA_ID_ID: '11111111-1111-4111-8111-111111111111',
    AUTH_MICROSOFT_ENTRA_ID_SECRET: 'fictitious',
    AUTH_MICROSOFT_ENTRA_ID_ISSUER:
      'https://login.microsoftonline.com/22222222-2222-4222-8222-222222222222/v2.0',
  };
  const build = spawnSync(
    process.execPath,
    [
      '--import',
      fileURLToPath(new URL('../../tests/db-commands/no-network.mjs', import.meta.url)),
      'node_modules/next/dist/bin/next',
      'build',
    ],
    { cwd: directory, env: buildEnv, encoding: 'utf8', maxBuffer: 8_000_000, timeout: 120_000 },
  );
  process.stdout.write(build.stdout ?? '');
  process.stderr.write(build.stderr ?? '');
  if (build.error || build.status !== 0)
    throw Error('Falló build Turbopack de instalación limpia.');
  if (/\[test-(?:network|database)-blocked\]/.test((build.stdout ?? '') + (build.stderr ?? ''))) {
    throw Error('La compilación intentó un efecto externo aunque capturó el error.');
  }
  console.log(
    'OK: npm ci limpio sin scripts/credenciales; lockfile intacto, sharp y build Turbopack operativos.',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
