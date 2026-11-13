import { spawn } from 'node:child_process';
import { integrationEnvironment } from './environment.mjs';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
const env = integrationEnvironment(process.env);
// Read only, after destination validation and before creating any fixture database.
const expected = JSON.parse(readFileSync(new URL('./runtime.json', import.meta.url), 'utf8'));
const sql = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 5 });
try {
  const [version] = await sql`SELECT current_setting('server_version') AS version,
    current_setting('server_version_num')::integer AS number`;
  const [major, minor] = expected.postgres.split('.').map(Number);
  if (version.number !== major * 10000 + minor) {
    throw Error(
      'PostgreSQL local/CI no coincide con scripts/ci/runtime.json; no se crearon fixtures.',
    );
  }
  console.log('PostgreSQL local/CI verificado: ' + version.version);
} finally {
  await sql.end();
}
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
