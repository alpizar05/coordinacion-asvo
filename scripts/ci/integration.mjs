import { spawn } from 'node:child_process';
import { integrationEnvironment } from './environment.mjs';
const env = integrationEnvironment(process.env);
const child = spawn(
  process.execPath,
  ['scripts/test-integration.mjs', '--skip-contracts', ...process.argv.slice(2)],
  {
    env,
    stdio: 'inherit',
    cwd: new URL('../../', import.meta.url),
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', () => {
  console.error('No se pudo iniciar la integración aislada.');
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
