import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { requireLocalDemo, requireTestRecipients } from '../lib/local-demo.mjs';

// The parent connection is used only to create/drop a dedicated disposable database.
const source = requireLocalDemo();
const database = 'asvo_dbops_test_' + randomUUID().replaceAll('-', '');
const target = new URL(source); target.pathname = '/' + database;
assert.match(database, /^asvo_dbops_test_[a-f0-9]+$/);
const admin = postgres(source.href, { max: 1, onnotice() {} });
let sql, created = false;
const env = { ...process.env, DATABASE_URL: target.href, ASVO_DEMO: '0' };
for (const key of Object.keys(env)) if (/^(GRAPH_|SHAREPOINT_|AUTH_|APP_URL$|NODE_OPTIONS$)/.test(key)) delete env[key];
async function command(file, args = [], overrides = {}, success = true) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', './tests/db-commands/no-network.mjs', file, ...args],
      { cwd: new URL('../', import.meta.url), env: { ...env, ...overrides }, stdio: ['ignore','pipe','pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    child.on('error', reject); child.on('close', code => resolve({ code, output }));
  });
  assert.equal(result.code === 0, success, `${file}: ${result.output}`);
  return result.output;
}
const tables = ['volunteers','requests','outings','registrations','policies','links','audit','demo_mail',
  'registration_mail_outbox','report_reminders','outing_invitations','outing_brief_links','grants',
  'request_outing_photos','outing_photos','app_migrations'];
async function snapshot() {
  const result = {};
  for (const table of tables) result[table] = await sql.unsafe(`select * from ${table} order by 1`);
  return JSON.parse(JSON.stringify(result));
}
try {
  await admin.unsafe(`create database "${database}"`); created = true;
  sql = postgres(target.href, { max: 1, onnotice() {} });
  assert.equal((await sql`select current_database() as name`)[0].name, database);
  await command('scripts/db.mjs');
  const blank = await snapshot();
  assert.ok(tables.every(table => blank[table].length === 0), 'Preparation created demo or historical records');
  await command('scripts/db.mjs'); assert.deepEqual(await snapshot(), blank);
  await command('scripts/db.mjs', ['--demo'], {}, false); assert.deepEqual(await snapshot(), blank);
  await command('scripts/db-history.mjs', [], {}, false); assert.deepEqual(await snapshot(), blank);
  for (const script of ['demo-registro','demo-agrupaciones','demo-calendario-noviembre','demo-attendance-reconciliation']) {
    await command(`scripts/${script}.mjs`, [], {}, false);
    await command(`scripts/${script}.mjs`, [], { ASVO_DEMO:'1', DATABASE_URL:'postgres://localhost/x?host=remote.invalid' }, false);
  }
  assert.deepEqual(await snapshot(), blank, 'Rejected seed changed the database');

  const request = randomUUID(), outing = randomUUID(), confirmed = randomUUID(), review = randomUUID(), waiting = randomUUID();
  const people = [randomUUID(), randomUUID(), randomUUID()];
  // Simulate an old unit constraint that has not yet been adopted. Only this isolated database is touched.
  await sql`alter table volunteers drop constraint volunteers_general_unit_required`;
  await sql`insert into units values ('Otros')`;
  for (let i=0;i<people.length;i++) {
    await sql`insert into volunteers(id,identification,name,surname,email,units)
      values(${people[i]},${'80000000'+i},'Ficticio','Migración',${`person${i}@example.test`},array['Otros'])`;
    await sql`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)
      values(${people[i]},'DEMO',${people[i]},'2030-01-01','2030-12-31',now())`;
  }
  await sql`insert into requests(id,organization,activity)values(${request},'DEMO','Prueba')`;
  await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status)
    values(${outing},${request},'DEMO','Local','Voluntariado General','2030-01-10','2030-01-12',false,2,'abierta')`;
  for (const [i,id,status] of [[0,confirmed,'confirmada'],[1,review,'validación'],[2,waiting,'validación']]) {
    await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details,received_at)
      values(${id},${outing},${status==='confirmada'?people[i]:null},${'80000000'+i},'2030-01-10','2030-01-12',${status},'{}'::jsonb,now()+${i}*interval '1 minute')`;
  }
  await sql`insert into outing_photos(outing_id,position,alt,credit,thumbnail,display_image)
    values(${outing},1,'DEMO','DEMO',${Buffer.from('fake')},${Buffer.from('fake')})`;
  await sql`insert into links(digest,registration_id,purpose,expires)values('existing-fake-link',${confirmed},'gestion',now()+interval '1 day')`;
  for (const sent of [false,true]) await sql`insert into registration_mail_outbox(registration_id,recipient,url,subject,body,attempts,sent_at)
    values(${confirmed},'existing@example.test','/fake','DEMO','DEMO',3,${sent?new Date('2026-01-01'):null})`;
  await sql`insert into demo_mail(recipient,url)values('existing@example.test','/fake')`;
  await sql`alter table volunteers add constraint volunteers_general_unit_required check (units @> array['Voluntariado General']::text[]) not valid`;
  const before = await snapshot();
  await command('scripts/db.mjs');
  assert.deepEqual(await snapshot(), before, 'Schema preparation changed existing data/queue/links');
  await command('scripts/db-history.mjs', ['--apply']);
  const after = await snapshot();
  for (const table of ['links','registration_mail_outbox','demo_mail','report_reminders','outing_invitations','outing_brief_links','grants'])
    assert.deepEqual(after[table], before[table], `Historical migration changed ${table}`);
  assert.equal(after.registrations.find(r=>r.id===confirmed).status,'confirmada');
  assert.equal(after.registrations.find(r=>r.id===review).status,'revisión');
  assert.equal(after.registrations.find(r=>r.id===waiting).status,'espera');
  assert.ok(after.volunteers.every(p=>p.units.includes('Voluntariado General')&&!p.units.includes('Otros')));
  assert.ok(after.requests[0].outing_defaults);assert.equal(after.requests[0].outing_photos_initialized,true);
  assert.equal(after.request_outing_photos.length,1);assert.equal(after.app_migrations.length,4);
  assert.equal(after.audit.filter(e=>e.action==='Adaptó inscripción al nuevo flujo').length,2);
  await command('scripts/db-history.mjs', ['--apply']); await command('scripts/db.mjs');
  assert.deepEqual(await snapshot(), after, 'Repeated history/setup changed rows or history markers');

  // A previously recorded workflow migration must never be replayed, even if imported old rows appear later.
  const legacy = randomUUID();
  await sql`insert into registrations(id,outing_id,identification,starts,ends,status,details)
    values(${legacy},${outing},'899999999','2030-01-10','2030-01-12','validación','{}'::jsonb)`;
  const marked = await snapshot(); await command('scripts/db-history.mjs',['--apply']);
  assert.deepEqual(await snapshot(), marked, 'Existing historical marker was ignored');

  for (const script of ['demo-registro','demo-agrupaciones','demo-calendario-noviembre','demo-attendance-reconciliation']) {
    await command(`scripts/${script}.mjs`, [], { ASVO_DEMO:'1' });
  }
  const seeded = await snapshot();
  for (const script of ['demo-registro','demo-agrupaciones','demo-calendario-noviembre','demo-attendance-reconciliation'])
    await command(`scripts/${script}.mjs`, [], { ASVO_DEMO:'1' });
  const twice = await snapshot();
  for (const table of ['volunteers','requests','outings','registrations','policies','request_outing_photos','outing_photos','grants'])
    assert.equal(twice[table].length, seeded[table].length, `Repeated demo duplicated ${table}`);
  requireTestRecipients(twice.volunteers.map(person=>person.email));
  requireTestRecipients((await sql`select lead_email from outing_reports`).map(report=>report.lead_email));
  assert.deepEqual(twice.registration_mail_outbox, after.registration_mail_outbox);
  assert.deepEqual(twice.links, after.links);assert.deepEqual(twice.demo_mail, after.demo_mail);
  const cron = await readFile(new URL('../vercel.json', import.meta.url),'utf8');
  assert.equal(JSON.parse(cron).crons[0].schedule,'0 12 * * *');
  console.log('OK: esquema repetible sin Graph, historial explícito/único sin comunicaciones, cola intacta, flags y destinos demo rechazados, ejemplos .test repetibles.');
} finally {
  if (sql) await sql.end();
  if (created) await admin.unsafe(`drop database "${database}" with (force)`);
  await admin.end();
  if (created) console.log('Base aislada de pruebas eliminada. Sin cambios en la base de aplicación ni correo real.');
}
