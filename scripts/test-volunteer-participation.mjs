import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const url = new URL(process.env.DATABASE_URL);
if (process.env.ASVO_DEMO !== '1' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) {
  throw new Error('La prueba requiere una base demo local.');
}
process.env.NODE_ENV = 'development';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (['next/headers','next/navigation'].includes(specifier)) return nextResolve(specifier + '.js', context);
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/.test(specifier)) {
    const candidate = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });
const { attendanceCases,saveAttendanceResolution } = await import('../lib/attendance-reconciliation.ts');
const { sql } = await import('../lib/db.ts');
const { volunteerParticipations,participationSummary,participationResult } = await import('../lib/volunteer-participation.ts');
const requestId=randomUUID(), person=randomUUID(), other=randomUUID(), third=randomUUID(),fourth=randomUUID();
const outings=Array.from({length:4},()=>randomUUID()), registrations=Array.from({length:8},()=>randomUUID());
try {
  await sql`insert into requests(id,organization,activity) values (${requestId},'Prueba trayectoria','Prueba')`;
  for (const id of [person,other,third,fourth]) await sql`insert into volunteers(id,identification,name,surname,email) values (${id},${randomUUID()},'Prueba','Trayectoria','trajectory@example.test')`;
  for (const [index,id] of outings.entries()) {
    const offset=[-3,2,-2,-1][index];
    await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)
      values (${id},${requestId},'Prueba trayectoria','Local','Voluntariado General',
      (clock_timestamp() at time zone 'America/Costa_Rica')::date+${offset}::int,
      (clock_timestamp() at time zone 'America/Costa_Rica')::date+${offset}::int,false,10,${index===3 ? 'cancelada' : 'completada'},false)`;
  }
  for (const [index,id] of registrations.entries()) {
    const outing=outings[[0,0,1,2,3,0,0,0][index]];
    await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)
      select ${id},o.id,${index===7 ? fourth : index===6 ? third : index===5 ? other : person},'TRAYECTORIA',o.starts,o.ends,${index===0 ? 'cancelada por voluntariado' : 'confirmada'},'{"assigned70":true}'::jsonb from outings o where o.id=${outing}`;
  }
  async function report(outing,lead,status,attended) {
    const participants=[{id:registrations[1],name:'Prueba Trayectoria',attended}];
    await sql`insert into outing_reports(outing_id,lead_registration_id,lead_name,lead_email,labour,location,activity,starts,ends,actions,host,participants,status)
      select o.id,${lead},'Prueba','trajectory@example.test','Prueba','Local','Prueba',o.starts,o.ends,'Prueba','Prueba',${sql.json(participants)},${status} from outings o where o.id=${outing}`;
  }
  await report(outings[0],registrations[1],'finalizado',true);
  await report(outings[0],registrations[5],'borrador',false);
  await report(outings[2],registrations[3],'borrador',true);
  let rows=await volunteerParticipations(person), summary=participationSummary(rows);
  assert.equal(summary.attended,1,'Cuenta la salida una vez aunque tenga reinscripciones');
  assert.equal(summary.lead,1,'Solo acredita responsabilidad mediante informes finalizados');
  assert.equal(summary.pending,1,'Un borrador mantiene informe pendiente; excluye canceladas y futuras');
  assert.equal(summary.conflicts,0,'Ignora discrepancias en borradores');
  assert.equal(summary.last.outing_id,outings[0]);
  assert.equal(participationResult(rows.find(row=>row.outing_id===outings[1])),'Asistencia pendiente de confirmar');
  await sql`update outing_reports set status='finalizado' where lead_registration_id=${registrations[5]}`;
  rows=await volunteerParticipations(person); summary=participationSummary(rows);
  assert.equal(summary.attended,0,'No acredita asistencias contradictorias');
  assert.equal(summary.conflicts,1,'No duplica la salida por conciliar');
  assert.equal(participationResult(rows.find(row=>row.outing_id===outings[0])),'Asistencia por conciliar');
  await sql`update outing_reports set participants=${sql.json([{id:registrations[1],name:'Prueba',attended:true}])} where lead_registration_id=${registrations[5]}`;
  assert.equal(participationSummary(await volunteerParticipations(person)).attended,1,'Varios informes concordantes cuentan una salida');
  await sql`update outing_reports set participants=${sql.json([{id:registrations[1],name:'Prueba',attended:false}])} where lead_registration_id=${registrations[5]}`;
  const reconcile = (decision,reason='Se revisaron las versiones con los responsables',version) => sql.begin(async tx=>{
    await tx`select id from outings where id=${outings[0]} for update`;
    const item=(await attendanceCases(outings[0],tx)).find(row=>row.volunteer_id===person);
    return saveAttendanceResolution(tx,outings[0],person,version || item.version,decision,reason,'coordinador-prueba');
  });
  assert.ok((await reconcile('participo','')).error,'Exige motivo');
  assert.ok((await reconcile('inventado')).error);
  assert.ok((await reconcile('participo','Motivo','desactualizada')).error,'No resuelve evidencia que cambió mientras se revisaba');
  assert.ok((await reconcile('pendiente')).saved);
  assert.equal(participationSummary(await volunteerParticipations(person)).attended,0);
  assert.ok((await reconcile('participo')).saved);
  assert.equal(participationSummary(await volunteerParticipations(person)).attended,1);
  assert.equal(participationResult((await volunteerParticipations(person)).find(row=>row.outing_id===outings[0])),'Participación confirmada · Conciliada');
  await report(outings[0],registrations[6],'finalizado',true);
  assert.equal(participationSummary(await volunteerParticipations(person)).attended,1,'Nuevo informe concordante conserva la resolución');
  await report(outings[0],registrations[7],'finalizado',false);
  let afterNew = await volunteerParticipations(person);
  assert.equal(participationSummary(afterNew).conflicts,1,'Un nuevo informe contrario reabre revisión');
  assert.ok(afterNew.find(row=>row.outing_id===outings[0]).resolution_stale);
  assert.ok((await reconcile('no_participo')).saved);
  assert.equal(participationSummary(await volunteerParticipations(person)).attended,0);
  const resolved=(await attendanceCases(outings[0])).find(row=>row.volunteer_id===person);
  assert.equal(resolved.history.length,3,'Conserva todas las versiones de la resolución');
  assert.equal((await sql`select participants from outing_reports where lead_registration_id=${registrations[5]}`)[0].participants[0].attended,false,'No modifica los informes originales');
  assert.equal((await volunteerParticipations(randomUUID())).length,0);
  console.log('OK: trayectoria, conciliación versionada, motivos, evidencia desactualizada y reapertura por informes contradictorios.');
} finally {
  await sql`delete from attendance_resolutions where outing_id=any(${outings}::uuid[])`;
  await sql`delete from audit where target=any(${[...outings,...registrations]}::text[])`;
  await sql`delete from outing_reports where outing_id=any(${outings}::uuid[])`;
  await sql`delete from registrations where outing_id=any(${outings}::uuid[])`;
  await sql`delete from outings where request_id=${requestId}`;
  await sql`delete from requests where id=${requestId}`;
  await sql`delete from volunteers where id=any(${[person,other,third,fourth]}::uuid[])`;
  await sql.end();
}
