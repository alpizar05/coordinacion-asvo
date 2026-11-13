import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { requireTransactionalMigration } from './migration-sql.mjs';
import { inspectSchema, schemaDifferences } from './schema-inspection.mjs';
const directory = new URL('../migrations/', import.meta.url);
const registry = 'asvo_schema_migrations';
const lock = 622617808; // Same advisory key as explicit historical data operations.
const hash = source => createHash('sha256').update(source).digest('hex');
export async function loadSchemaMigrations(folder = directory) {
  const files = (await readdir(folder)).filter(file=>file.endsWith('.sql')).sort();
  if (!files.length) throw new Error('No hay migraciones SQL.');
  const migrations = [];
  for (const file of files) {
    if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(file)) throw new Error(`Nombre de migración inválido: ${file}`);
    const id = file.slice(0,-4), source = await readFile(new URL(file,folder),'utf8');
    if (migrations.some(m=>m.id.slice(0,4)===id.slice(0,4))) throw new Error(`Número de migración duplicado: ${id}`);
    requireTransactionalMigration(source,id);
    migrations.push({ id, source, checksum:hash(source) });
  }
  if (migrations[0].id!=='0001_initial') throw new Error('La primera migración debe ser 0001_initial.');
  return migrations;
}
async function baselineManifest(migrations, folder) {
  const manifest = JSON.parse(await readFile(new URL('0001_initial.schema.json',folder),'utf8'));
  if (manifest.sourceChecksum!==migrations[0].checksum) throw new Error('El catálogo generado no corresponde a 0001_initial. Regeneralo desde el SQL en una base local desechable.');
  return manifest.catalog;
}
async function transaction(connection, work, readOnly = false) {
  await connection.unsafe(readOnly?'begin isolation level repeatable read read only':'begin');
  try { const result = await work(connection); await connection.unsafe('commit'); return result; }
  catch (error) { await connection.unsafe('rollback'); throw error; }
}
async function recorded(connection) {
  const [relation] = await connection`select c.oid,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=current_schema() and c.relname=${registry}`;
  if (!relation) return { exists:false, rows:[] };
  if (relation.relkind!=='r') throw new Error('El registro de migraciones no es una tabla válida.');
  const columns = await connection`select attname,format_type(atttypid,atttypmod) as type,attnotnull from pg_attribute
    where attrelid=${relation.oid} and attnum>0 and not attisdropped order by attnum`;
  const required = [['id','text'],['checksum','text'],['applied_at','timestamp with time zone'],['mode','text']];
  if (required.some(([name,type])=>!columns.some(c=>c.attname===name&&c.type===type&&c.attnotnull))) throw new Error('Estructura incompatible del registro de migraciones.');
  const [primary] = await connection`select 1 from pg_constraint where conrelid=${relation.oid} and contype='p' and pg_get_constraintdef(oid)='PRIMARY KEY (id)'`;
  if (!primary) throw new Error('El registro de migraciones requiere clave primaria en id.');
  const rows = await connection`select id,checksum,applied_at,mode from asvo_schema_migrations order by id`;
  return { exists:true, rows };
}
function verifyHistory(migrations, rows) {
  for (const [index,row] of rows.entries()) {
    const migration = migrations.find(m=>m.id===row.id);
    if (!migration) throw new Error(`Migración aplicada sin archivo disponible: ${row.id}. No se ejecutó ningún cambio.`);
    if (migration.checksum!==row.checksum) throw new Error(`Checksum alterado en migración aplicada ${row.id}. Restaurá el archivo original; creá otra migración para cambios nuevos.`);
    if (migrations[index]?.id!==row.id || !['applied','baseline'].includes(row.mode)) throw new Error(`Secuencia de migraciones inválida: ${row.id}.`);
  }
}
async function inspectPlan(connection, migrations, folder) {
  const state = await recorded(connection);
  verifyHistory(migrations,state.rows);
  const pending = migrations.slice(state.rows.length).map(({id,checksum})=>({id,checksum}));
  if (state.rows.length) return { kind:'tracked',applied:state.rows,pending,adoption:null };
  const expected = await baselineManifest(migrations,folder);
  const actual = await inspectSchema(connection);
  if (!actual.relations.length && !actual.functions.length) return {kind:'empty',applied:[],pending,adoption:null};
  const differences = schemaDifferences(expected,actual);
  return {kind:'existing',applied:[],pending,adoption:{compatible:!differences.length,differences}};
}
async function ensureRegistry(connection) {
  await connection.unsafe(`create table if not exists ${registry} (
    id text primary key, checksum text not null check(checksum ~ '^[0-9a-f]{64}$'),
    applied_at timestamptz not null default clock_timestamp(), mode text not null check(mode in ('applied','baseline'))
  )`);
}
/** Explicitly invoked only by CLI/tests. Importing this module never opens a connection or migrates. */
export async function schemaMigrationOperation(sql, { action='apply', folder=directory } = {}) {
  if (!['apply','adopt','status','plan'].includes(action)) throw new Error('Operación de migraciones inválida.');
  const migrations = await loadSchemaMigrations(folder);
  const connection = await sql.reserve();
  let locked = false;
  try {
    if (action==='status'||action==='plan') return await transaction(connection,c=>inspectPlan(c,migrations,folder),true);
    await connection.unsafe("set lock_timeout = '15s'");
    await connection`select pg_advisory_lock(${lock})`; locked = true;
    const plan = await transaction(connection,c=>inspectPlan(c,migrations,folder));
    if (action==='adopt') {
      if (plan.kind==='tracked') return {...plan,adopted:false};
      if (plan.kind!=='existing'||!plan.adoption.compatible) throw new Error('No se puede adoptar la baseline: '+(plan.adoption?.differences.join('; ')??'la base está vacía; usá db:migrate.'));
      await transaction(connection, async c=>{
        // Lock existing core relations against DDL and recheck under the same transaction.
        const catalog = await baselineManifest(migrations,folder);
        for (const relation of catalog.relations.filter(r=>r.kind==='r').sort((a,b)=>a.name.localeCompare(b.name)))
          await c.unsafe(`lock table "${relation.name}" in access share mode`);
        const differences = schemaDifferences(catalog,await inspectSchema(c));
        if (differences.length) throw new Error('El esquema cambió durante la adopción: '+differences.join('; '));
        await ensureRegistry(c);
        await c`insert into asvo_schema_migrations(id,checksum,mode) values(${migrations[0].id},${migrations[0].checksum},'baseline')`;
      });
      return {kind:'tracked',adopted:true,baseline:migrations[0].id,pending:migrations.slice(1).map(m=>({id:m.id,checksum:m.checksum}))};
    }
    if (plan.kind==='existing') throw new Error('La base existente no tiene baseline registrada. Revisá db:plan y ejecutá db:adopt -- --apply solo si es compatible.');
    const applied = [];
    for (const migration of migrations.slice(plan.applied.length)) {
      try {
        await transaction(connection,async c=>{
          await ensureRegistry(c);
          await c.unsafe(migration.source);
          await c`insert into asvo_schema_migrations(id,checksum,mode)values(${migration.id},${migration.checksum},'applied')`;
        });
        applied.push(migration.id);
      } catch (error) {
        throw new Error(`Falló ${migration.id}; su transacción fue revertida. Las migraciones anteriores confirmadas permanecen. Revisá la causa y reintentá; no borres marcas.`,{cause:error});
      }
    }
    return {kind:'tracked',executed:applied,pending:[]};
  } finally {
    try { if (locked) await connection`select pg_advisory_unlock(${lock})`; }
    finally { try { await connection.unsafe('reset lock_timeout'); } finally { connection.release(); } }
  }
}
