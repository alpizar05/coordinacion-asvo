import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
const folder = join(project, '.local-postgres');
const data = join(folder, 'data');
const native = join(folder, 'runtime/node_modules/@embedded-postgres/darwin-arm64/native');
const connection = new URL(process.env.DATABASE_URL);
if (process.env.ASVO_DEMO !== '1' || connection.hostname !== '127.0.0.1' || process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('Este comando requiere modo demo local en un Mac con Apple Silicon.');
}
if (!existsSync(join(native, 'bin/pg_ctl'))) {
  throw new Error('Instalá PostgreSQL local con npm install --prefix .local-postgres/runtime --no-save --package-lock=false @embedded-postgres/darwin-arm64@18.6.0-beta.19');
}

function run(binary, args, input) {
  const result = spawnSync(join(native, 'bin', binary), args, { encoding: 'utf8', input });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Falló ${binary}`);
  return result.stdout;
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
