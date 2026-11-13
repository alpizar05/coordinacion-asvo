/** Explicit CI check only: never imported by application startup/build. */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { cleanTestEnvironment } from '../../tests/test-process.mjs';
const expected = JSON.parse(readFileSync(new URL('./runtime.json', import.meta.url), 'utf8'));
function version(command, args) {
  const result = spawnSync(command, args, {
    env: cleanTestEnvironment(),
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (result.error || result.status !== 0) throw Error('No se pudo verificar el runtime hijo.');
  return result.stdout.trim().replace(/^v/, '');
}
const report = {
  node: process.versions.node,
  childNode: version(process.execPath, ['--version']),
  pathNode: version('node', ['--version']),
  npm: version('npm', ['--version']),
};
if (
  [report.node, report.childNode, report.pathNode].some((value) => value !== expected.node) ||
  report.npm !== expected.npm
) {
  throw Error('Runtime distinto del pin local/CI; seleccioná Node/npm de scripts/ci/runtime.json.');
}
console.log(JSON.stringify(report));
