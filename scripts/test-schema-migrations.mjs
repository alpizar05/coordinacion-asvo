import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { requireLocalDemo } from '../lib/local-demo.mjs';
import { loadSchemaMigrations, schemaMigrationOperation as runMigrations } from '../lib/schema-migrations.mjs';
import { inspectSchema, schemaDifferences } from '../lib/schema-inspection.mjs';

const source = requireLocalDemo(), admin = postgres(source.href,{max:1,onnotice(){}});
const databases=[], folders=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('Red externa prohibida en estas pruebas.');};
async function database(){
  const name='asvo_migrations_test_'+randomUUID().replaceAll('-','');
  await admin.unsafe(`create database "${name}"`);
  const url=new URL(source);url.pathname='/'+name;
  const sql=postgres(url.href,{max:1,onnotice(){}});databases.push({name,sql,url});
  assert.equal((await sql`select current_database() as name`)[0].name,name);return sql;
}
async function folder(){
  const path=await mkdtemp(join(tmpdir(),'asvo-migrations-'));folders.push(path);
  await cp(new URL('../migrations/',import.meta.url),path,{recursive:true});for(const file of await readdir(path))if(file.endsWith('.sql')&&file!=='0001_initial.sql')await rm(join(path,file));return pathToFileURL(path+'/');
}
let baselineFolder;
const operate=(sql,options={})=>runMigrations(sql,{folder:baselineFolder,...options});
const initial=(await loadSchemaMigrations())[0];
const manifest=JSON.parse(await readFile(new URL('../migrations/0001_initial.schema.json',import.meta.url),'utf8'));
const exists=async(sql,name)=>(await sql`select to_regclass(${name}) as object`)[0].object!==null;
async function businessSnapshot(sql){
  const tables=['app_migrations','volunteers','requests','outings','registrations','links','demo_mail','registration_mail_outbox','request_outing_photos'];
  const result={};for(const table of tables)result[table]=await sql.unsafe(`select * from ${table} order by 1`);
  return JSON.parse(JSON.stringify(result));
}
try{
  baselineFolder=await folder();
  assert.equal(manifest.sourceChecksum,initial.checksum);
  const empty=await database();
  for(const action of ['status','plan'])assert.equal((await operate(empty,{action})).kind,'empty');
  assert.equal(await exists(empty,'asvo_schema_migrations'),false,'Read-only plan wrote a registry');
  assert.equal(await exists(empty,'volunteers'),false);
  assert.deepEqual((await operate(empty)).executed,['0001_initial']);
  const [row]=await empty`select * from asvo_schema_migrations`;
  assert.equal(row.checksum,initial.checksum);assert.equal(row.mode,'applied');assert.ok(row.applied_at instanceof Date);
  assert.deepEqual(schemaDifferences(manifest.catalog,await inspectSchema(empty)),[]);
  const before=await businessSnapshot(empty);const ledger=await empty`select * from asvo_schema_migrations`;
  assert.deepEqual((await operate(empty)).executed,[]);assert.deepEqual(await businessSnapshot(empty),before);
  assert.deepEqual(await empty`select * from asvo_schema_migrations`,ledger);
  console.log('OK: base vacía, estado/plan sin escrituras, registro/checksum/fecha y segunda ejecución.');

  const legacy=await database();await legacy.unsafe(initial.source);
  await legacy.unsafe(await readFile(new URL('../historical-import.sql',import.meta.url),'utf8'));
  for(const name of ['legacy-volunteer-units-v1','legacy-outing-defaults-v1','legacy-outing-photos-v1','received-registration-reservations-v1'])
    await legacy`insert into app_migrations(name,applied_at) values(${name},'2026-01-01')`;
  await legacy`alter table volunteers validate constraint volunteers_general_unit_required`;
  await legacy`insert into units(name)values('Otros')`;
  const person=randomUUID(),request=randomUUID(),outing=randomUUID(),registration=randomUUID();
  await legacy`insert into volunteers(id,identification,name,surname,email) values(${person},'800000001','Persona','Ficticia','fake@example.test')`;
  await legacy`insert into requests(id,organization,activity)values(${request},'DEMO','Prueba')`;
  await legacy`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status)
    values(${outing},${request},'DEMO','Local','Voluntariado General','2030-01-10','2030-01-12',false,1,'abierta')`;
  await legacy`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)
    values(${registration},${outing},${person},'800000001','2030-01-10','2030-01-12','validación','{}'::jsonb)`;
  await legacy`insert into links(digest,registration_id,purpose,expires)values('fake-existing-link',${registration},'gestion','2030-01-01')`;
  await legacy`insert into registration_mail_outbox(registration_id,recipient,url,subject,body,attempts)values(${registration},'fake@example.test','/fake','DEMO','DEMO',4)`;
  const oldData=await businessSnapshot(legacy),oldCatalog=await inspectSchema(legacy);
  const plan=await operate(legacy,{action:'plan'});assert.equal(plan.adoption.compatible,true);
  assert.equal(await exists(legacy,'asvo_schema_migrations'),false);assert.deepEqual(await businessSnapshot(legacy),oldData);
  await assert.rejects(operate(legacy),/db:adopt/);assert.equal(await exists(legacy,'asvo_schema_migrations'),false);
  const future=await folder();
  await writeFile(new URL('0002_future.sql',future),'create table future_probe(id int);');
  const adoption=await operate(legacy,{action:'adopt',folder:future});
  assert.equal(adoption.adopted,true);assert.deepEqual(adoption.pending.map(m=>m.id),['0002_future']);
  assert.equal(await exists(legacy,'future_probe'),false);
  assert.equal((await legacy`select count(*)::int as n from asvo_schema_migrations`)[0].n,1);
  assert.equal((await legacy`select mode from asvo_schema_migrations`)[0].mode,'baseline');
  assert.deepEqual(await businessSnapshot(legacy),oldData);assert.deepEqual(await inspectSchema(legacy),oldCatalog);
  assert.equal((await operate(legacy,{action:'adopt'})).adopted,false);
  assert.deepEqual((await operate(legacy)).executed,[]);
  console.log('OK: adopción compatible, extensiones históricas, restricción validada y marcas/datos/cola/enlaces intactos.');

  // Apply the real additive photo migration to an adopted legacy database, retaining business data.
  assert.deepEqual((await runMigrations(legacy)).executed,['0002_photo_upload_lifecycle']);
  assert.deepEqual(await businessSnapshot(legacy),oldData);
  assert.deepEqual((await runMigrations(legacy)).executed,[]);
  assert.equal(await exists(legacy,'photo_upload_items'),true);
  console.log('OK: migración de cargas sobre baseline adoptada sin modificar fotos, cola ni datos históricos; segunda ejecución sin cambios.');

  const invalid=await database();await invalid.unsafe(initial.source);
  await invalid`alter table registrations drop column details`;
  await invalid`alter table outings alter column status set default 'otra'`;
  await invalid`alter table outings alter column title type text collate "C"`;
  await invalid`alter table volunteers enable row level security`;
  await invalid`alter table registrations drop constraint registrations_policy_id_fkey`;
  await invalid`drop index one_valid_registration`;
  await invalid`create unique index one_valid_registration on registrations(outing_id,volunteer_id) where status='confirmada'`;
  await invalid`alter function attendance_resolution_is_current(text,jsonb,jsonb) security definer`;
  await invalid`delete from units where name='UEA'`;
  const incompatible=await operate(invalid,{action:'plan'});
  assert.equal(incompatible.adoption.compatible,false);
  for(const part of ['relations','columns','constraints','indexes','functions','units'])assert.ok(incompatible.adoption.differences.some(d=>d.startsWith(part+':')),part);
  await assert.rejects(operate(invalid,{action:'adopt'}),/No se puede adoptar/);
  assert.equal(await exists(invalid,'asvo_schema_migrations'),false);
  assert.equal((await invalid`select column_default from information_schema.columns where table_schema=current_schema() and table_name='outings' and column_name='status'`)[0].column_default,"'otra'::text");
  console.log('OK: adopción incompatible no escribe ni repara columnas/defaults/FK/índice/función/referencias.');

  const changed=await folder();
  await writeFile(new URL('0001_initial.sql',changed),initial.source+'\n-- altered after application\n');
  await assert.rejects(operate(empty,{folder:changed}),/Checksum alterado/);
  await assert.rejects(operate(empty,{action:'status',folder:changed}),/Checksum alterado/);
  assert.deepEqual(await empty`select * from asvo_schema_migrations`,ledger);
  console.log('OK: checksum aplicado modificado detiene consulta y ejecución antes de escribir.');

  const failed=await database(), failures=await folder();
  await writeFile(new URL('0002_probe.sql',failures),'create table rollback_probe(id int primary key); insert into rollback_probe values(1); select 1/0;');
  await writeFile(new URL('0003_later.sql',failures),'create table later_probe(id int primary key);');
  await assert.rejects(operate(failed,{folder:failures}),/Falló 0002_probe/);
  assert.equal(await exists(failed,'rollback_probe'),false);assert.equal(await exists(failed,'later_probe'),false);
  assert.deepEqual((await failed`select id from asvo_schema_migrations`).map(r=>r.id),['0001_initial']);
  assert.equal((await operate(failed,{action:'plan',folder:failures})).pending.length,2);
  await writeFile(new URL('0002_probe.sql',failures),'create table rollback_probe(id int primary key); insert into rollback_probe values(1);');
  assert.deepEqual((await operate(failed,{folder:failures})).executed,['0002_probe','0003_later']);
  assert.equal((await failed`select * from rollback_probe`).length,1);
  console.log('OK: fallo intermedio revierte DDL/datos/marca de esa migración; reintento conserva pasos confirmados.');

  const concurrent=await database(), slow=await folder();
  await writeFile(new URL('0002_once.sql',slow),'select pg_sleep(0.3); create table once_probe(id int primary key); insert into once_probe values(1);');
  const connection=postgres(databases.at(-1).url.href,{max:1,onnotice(){}});
  try{
    const result=await Promise.all([operate(concurrent,{folder:slow}),operate(connection,{folder:slow})]);
    assert.equal(result.reduce((sum,r)=>sum+r.executed.length,0),2);
    assert.equal((await concurrent`select * from once_probe`).length,1);
    assert.equal((await concurrent`select * from asvo_schema_migrations`).length,2);
  }finally{await connection.end();}
  console.log('OK: dos ejecutores simultáneos serializados; una aplicación y una marca por migración.');

  const scoped=await database();await scoped`create schema isolated_import`;
  await scoped`set search_path to isolated_import`;
  await operate(scoped);
  assert.equal((await scoped`select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='volunteers'`)[0].n,0);
  assert.deepEqual(schemaDifferences(manifest.catalog,await inspectSchema(scoped)),[]);
  console.log('OK: esquema de pruebas de importación usa el mismo ejecutor sin escribir en public.');
} finally {
  globalThis.fetch=originalFetch;
  for(const item of databases){await item.sql.end();await admin.unsafe(`drop database "${item.name}" with (force)`);}
  await admin.end();
  for(const path of folders)await rm(path,{recursive:true,force:true});
  console.log('Bases y archivos temporales retirados; sin beta, mensajes ni proveedores reales.');
}
