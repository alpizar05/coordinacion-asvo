import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import { requireLocalDemo } from '../lib/local-demo.mjs';
import { inspectSchema } from '../lib/schema-inspection.mjs';

// Generated metadata, never a second SQL source. Only an empty disposable local DB is used.
const source = requireLocalDemo(), name = 'asvo_catalog_test_' + randomUUID().replaceAll('-','');
const target = new URL(source); target.pathname='/' + name;
const admin = postgres(source.href,{max:1,onnotice(){}});
let sql, created=false;
try {
  await admin.unsafe(`create database "${name}"`); created=true;
  sql=postgres(target.href,{max:1,onnotice(){}});
  const [{database}]=await sql`select current_database() as database`; if(database!==name)throw new Error('Destino inesperado.');
  const migration=await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');
  await sql.begin(tx=>tx.unsafe(migration));
  const catalog=await inspectSchema(sql);
  await writeFile(new URL('../migrations/0001_initial.schema.json',import.meta.url),JSON.stringify({
    generated:'scripts/generate-baseline-catalog.mjs; do not edit manually',
    sourceChecksum:createHash('sha256').update(migration).digest('hex'),catalog,
  },null,2)+'\n');
  console.log(`Catálogo derivado generado: ${catalog.relations.length} relaciones, ${catalog.columns.length} columnas y ${catalog.constraints.length} restricciones.`);
} finally {
  if(sql)await sql.end();
  if(created)await admin.unsafe(`drop database "${name}" with (force)`);
  await admin.end();
  if(created)console.log('Base temporal del generador eliminada.');
}
