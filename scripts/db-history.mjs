import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { migrateRegistrationWorkflow } from '../lib/registration-workflow-migration.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--apply') {
  throw new Error('Transformaciones históricas explícitas: revisá docs/operaciones-base-datos.md y ejecutá db:migrate:history -- --apply. No prepara el esquema ni envía avisos.');
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  for (const [name, file] of [
    ['legacy-volunteer-units-v1', 'volunteer-units.sql'],
    ['legacy-outing-defaults-v1', 'outing-defaults.sql'],
    ['legacy-outing-photos-v1', 'outing-photos.sql'],
  ]) {
    const source = await readFile(new URL(`./historical-data/${file}`, import.meta.url), 'utf8');
    const applied = await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(622617808)`;
      if ((await tx`select 1 from app_migrations where name=${name}`).length) return false;
      await tx.unsafe(source);
      await tx`insert into app_migrations(name) values (${name})`;
      return true;
    });
    console.log(`${name}: ${applied ? 'aplicada' : 'ya aplicada'}`);
  }
  const result = await migrateRegistrationWorkflow(sql);
  console.log(`received-registration-reservations-v1: ${result.applied ? 'aplicada' : 'ya aplicada'}`);
  console.log('Sin comunicaciones históricas, enlaces nuevos ni procesamiento de la cola.');
} finally {
  await sql.end();
}
