import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sanitizedFindings } from './secret-report.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cleanTestEnvironment } from '../../tests/test-process.mjs';
const env = cleanTestEnvironment(),
  cwd = new URL('../../', import.meta.url);
const files = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd,
  env,
  encoding: 'utf8',
});
if (files.status !== 0) throw Error('No se pudo inventariar archivos para revisión de secretos.');
const paths = [...new Set(files.stdout.split('\0').filter(Boolean))].filter(
  (path) =>
    !path.startsWith('.codex/') &&
    !/\.(png|jpg|jpeg|ico|pdf|webp|woff2?)$/i.test(path) &&
    (!path.startsWith('.env') || path === '.env.example'),
);
const exposed = files.stdout
  .split('\0')
  .filter((p) => /^\.env(?:\.|$)/.test(p) && p !== '.env.example');
if (exposed.length) throw Error('Archivo de entorno privado presente en el inventario publicable.');
let findings = [],
  failures = [];
function scan(args, input) {
  const child = spawnSync(
    process.execPath,
    ['node_modules/secretlint/bin/secretlint.js', '--format', 'json', '--no-color', ...args],
    { cwd, env, input, encoding: 'utf8', maxBuffer: 16_000_000 },
  );
  if (child.error || ![0, 1].includes(child.status)) {
    failures.push('scanner_unavailable');
    return;
  }
  let results;
  try {
    results = JSON.parse(child.stdout);
  } catch {
    failures.push('scanner_report_invalid');
    return;
  }
  if (child.status === 1 && !results.some((result) => result.messages?.length)) {
    failures.push('scanner_failed_without_findings');
  }
  findings.push(...sanitizedFindings(results, fileURLToPath(cwd)));
}
for (let offset = 0; offset < paths.length; offset += 60)
  scan(['--no-glob', ...paths.slice(offset, offset + 60)]);
const history = spawnSync(
  'git',
  [
    'log',
    '--all',
    '--format=',
    '-p',
    '--no-ext-diff',
    '--',
    '.',
    ':!.codex',
    ':!*.png',
    ':!*.jpg',
    ':!*.jpeg',
    ':!*.ico',
    ':!*.pdf',
    ':!*.webp',
  ],
  { cwd, env, encoding: 'utf8', maxBuffer: 64_000_000 },
);
if (history.error || history.status !== 0) failures.push('history_unavailable_or_truncated');
else scan(['--stdinFileName=repository-history.patch'], history.stdout);
const output = {
  scope: 'Publishable worktree and locally available git history',
  files: paths.length,
  findings,
  failures,
  note: 'Heuristic scan, not proof of absence; private dotenv files are not read.',
};
mkdirSync('coverage', { recursive: true });
writeFileSync('coverage/secret-audit.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
if (findings.length || failures.length) process.exitCode = 1;
