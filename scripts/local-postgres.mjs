import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import postgres from 'postgres';
import { requireLocalDemo } from '../lib/local-demo.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const folder = join(project, '.local-postgres');
const data = join(folder, 'data');
const versions = JSON.parse(readFileSync(join(project, 'scripts/ci/runtime.json'), 'utf8'));
const native = join(folder, `runtime-${versions.postgres}`);
const connection = requireLocalDemo();
if (process.env.ASVO_DEMO !== '1' || connection.hostname !== '127.0.0.1' || process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('Este comando requiere modo demo local en un Mac con Apple Silicon.');
}
if (!existsSync(join(native, 'bin/pg_ctl'))) {
  throw new Error(`Falta PostgreSQL ${versions.postgres} en .local-postgres/runtime-${versions.postgres}. Revisá docs/entorno-local-versiones.md; no se inicia silenciosamente el runtime anterior.`);
}

function run(binary, args, input) {
  const result = spawnSync(join(native, 'bin', binary), args, { encoding: 'utf8', input });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Falló ${binary}`);
  return result.stdout;
}
if (run('postgres', ['--version']).trim() !== `postgres (PostgreSQL) ${versions.postgres}`) {
  throw new Error(`El binario local debe ser PostgreSQL ${versions.postgres}.`);
}

mkdirSync(folder, { recursive: true });
if (!existsSync(join(data, 'PG_VERSION'))) {
  run('initdb', ['-D', data, '-U', decodeURIComponent(connection.username),
    '--pwfile=/dev/stdin', '--auth-host=scram-sha-256', '--auth-local=trust',
    '--encoding=UTF8', '--locale=C'], decodeURIComponent(connection.password) + '\n');
}
const status = spawnSync(join(native, 'bin/pg_ctl'), ['-D', data, 'status'], { encoding: 'utf8' });
if (status.status === 0) console.log('PostgreSQL local ya está activo.');
else {
  run('pg_ctl', ['-D', data, '-l', join(folder, 'postgres.log'),
    '-o', `-h 127.0.0.1 -p ${connection.port || '5432'} -k ''`, '-w', 'start']);
  console.log(`PostgreSQL local activo en 127.0.0.1:${connection.port || '5432'}.`);
}
const sql = postgres(connection.href, { max: 1, connect_timeout: 5 });
try {
  const [server] = await sql`select current_setting('server_version') as version, current_setting('data_directory') as directory`;
  if (server.directory !== data || server.version !== versions.postgres) {
    throw new Error(`El servidor activo no corresponde al clúster local y PostgreSQL ${versions.postgres} esperados. No se modificaron sus datos.`);
  }
  console.log(`Versión del servidor verificada: PostgreSQL ${server.version}.`);
} finally {
  await sql.end();
}
