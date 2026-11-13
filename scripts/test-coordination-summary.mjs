import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';
requireDisposableTestDatabase();
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
const { sql } = await import('../lib/db.ts');
const { reportReminderIsCurrent } = await import('../lib/mail-outbox.mjs');
const { queueReportReminder } = await import('../lib/report-reminders.ts');
const { coordinationSummary } = await import('../lib/coordination-summary.ts');
const scope = `Resumen prueba ${randomUUID()}`;
const requestId = randomUUID(), person = randomUUID();
const ids = Array.from({length:5},() => randomUUID());
try {
  await sql`insert into units(name) values (${scope})`;
  await sql`insert into requests(id,organization,activity) values (${requestId},'Prueba Resumen','Prueba')`;
  await sql`insert into volunteers(id,identification,name,surname,email,units) values (${person},${randomUUID()},'Persona','Resumen','summary@example.test',${['Voluntariado General',scope]})`;
  for (const [index,id] of ids.entries()) {
    const offset = [1,13,-4,-6,2][index];
    await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)
      values (${id},${requestId},${`Resumen ${index}`},'Local',${scope},
      (clock_timestamp() at time zone 'America/Costa_Rica')::date+${offset}::int,
      (clock_timestamp() at time zone 'America/Costa_Rica')::date+${offset}::int,false,3,${index === 4 ? 'cancelada' : 'abierta'},false)`;
  }
  const [review] = await sql`insert into registrations(outing_id,volunteer_id,identification,starts,ends,status,details)
    select id,${person},'PRUEBARESUMEN',starts,ends,'revisión','{}'::jsonb from outings where id=${ids[0]} returning id`;
  await sql`insert into registrations(outing_id,volunteer_id,identification,starts,ends,status,details)
    select id,${person},'PRUEBARESUMEN',starts,ends,'confirmada','{"assigned70":true,"transporte":true}'::jsonb from outings where id=${ids[1]}`;
  const short = await coordinationSummary(false,[scope],scope,7);
  assert.equal(short.reviews.length,1);
  assert.equal(short.upcoming.length,1,'Excluye canceladas y salidas fuera del periodo');
  assert.equal(short.reports.length,2,'Detecta salidas finalizadas sin responsable ni informe');
  const long = await coordinationSummary(false,[scope],scope,14);
  assert.equal(long.upcoming.length,2);
  assert.ok(long.upcoming.find(row => row.id===ids[1]).leads,'Reconoce 70 confirmado');
  const [lead] = await sql`insert into registrations(outing_id,volunteer_id,identification,starts,ends,status,details)
    select id,${person},'PRUEBARESUMEN',starts,ends,'confirmada','{"assigned70":true}'::jsonb from outings where id=${ids[2]} returning id`;
  assert.equal((await coordinationSummary(false,[scope],scope,7)).reports.find(row => row.id===ids[2]).missing,1);
  const remind = () => sql.begin(async tx => {
    await tx`select id from outings where id=${ids[2]} for update`;
    return queueReportReminder(tx,ids[2],lead.id,'coordinador-prueba','summary@example.test',{isDemo:false});
  });
  const concurrentReminders = await Promise.all([remind(),remind()]);
  assert.equal(concurrentReminders.filter(result=>result.saved).length,1,'Solo crea un recordatorio pendiente aun con envíos concurrentes');
  assert.equal(concurrentReminders.filter(result=>result.error).length,1);
  const [firstReminder] = await sql`select q.*,m.body,m.html_body,m.url from report_reminders q join registration_mail_outbox m on m.id=q.mail_id where q.registration_id=${lead.id}`;
  assert.equal(await reportReminderIsCurrent(sql,firstReminder.mail_id),true,'El recordatorio vigente puede enviarse');
  assert.match(firstReminder.body,/Completar informe de salida/);
  assert.match(firstReminder.html_body,/logo-asvo.png/);
  assert.ok((await coordinationSummary(false,[scope],scope,7)).reportPeople.find(row=>row.id===lead.id).pending);
  await sql`update registration_mail_outbox set sent_at=now() where id=${firstReminder.mail_id}`;
  assert.equal((await remind()).saved,true,'Permite recordatorio manual posterior al envío');
  const reminders = await sql`select q.*,m.url from report_reminders q join registration_mail_outbox m on m.id=q.mail_id where q.registration_id=${lead.id} order by q.id`;
  assert.equal(reminders[0].link_digest,reminders[1].link_digest,'Reutiliza enlace recuperable vigente');
  await sql`update registration_mail_outbox set sent_at=now() where registration_id=${lead.id}`;
  await sql`update outing_brief_links set revoked_at=now() where lead_registration_id=${lead.id}`;
  assert.equal(await reportReminderIsCurrent(sql,firstReminder.mail_id),false,'No envía enlaces revocados');
  assert.equal((await remind()).saved,true,'Genera nuevo enlace si el anterior fue revocado');

  await sql`insert into outing_reports(outing_id,lead_registration_id,lead_name,lead_email,labour,location,activity,starts,ends,actions,host,participants)
    select id,${lead.id},'Persona Resumen','summary@example.test','Prueba','Local','Prueba',starts,ends,'Prueba','Prueba','[]'::jsonb from outings where id=${ids[2]}`;
  await sql`update outing_reports set status='borrador',submitted_at=null where lead_registration_id=${lead.id}`;
  assert.equal((await coordinationSummary(false,[scope],scope,7)).reports.length,2,'El borrador mantiene la tarea pendiente');
  const [latestDraftMail] = await sql`select mail_id from report_reminders where registration_id=${lead.id} order by id desc limit 1`;
  assert.equal(await reportReminderIsCurrent(sql,latestDraftMail.mail_id),true,'El borrador no suspende recordatorios');
  await sql`update outing_reports set status='finalizado',submitted_at=now() where lead_registration_id=${lead.id}`;
  assert.equal((await coordinationSummary(false,[scope],scope,7)).reports.length,1,'Presentar el informe elimina el pendiente del 70');
  assert.ok((await remind()).error,'No recuerda un informe ya presentado');
  const [latest] = await sql`select mail_id from report_reminders where registration_id=${lead.id} order by id desc limit 1`;
  assert.equal(await reportReminderIsCurrent(sql,latest.mail_id),false,'El reintento descarta recordatorios de informes ya presentados');
  const denied = await coordinationSummary(false,[],scope,14);
  assert.equal(denied.reviews.length+denied.upcoming.length+denied.reports.length,0,'No filtra datos de unidades no autorizadas');
  await sql`update registrations set status='confirmada' where id=${review.id}`;
  assert.equal((await coordinationSummary(false,[scope],scope,7)).reviews.length,0,'Actualiza pendientes al confirmar');
  console.log('OK: Resumen filtra unidades, periodos, estados, 70, informes y cambios de inscripción.');
} finally {
  await sql`delete from report_reminders where registration_id in(select id from registrations where outing_id=any(${ids}::uuid[]))`;
  await sql`delete from registration_mail_outbox where registration_id in(select id from registrations where outing_id=any(${ids}::uuid[]))`;
  await sql`delete from audit where target=any(${ids}::text[])`;
  await sql`delete from registrations where outing_id=any(${ids}::uuid[])`;
  await sql`delete from outings where request_id=${requestId}`;
  await sql`delete from requests where id=${requestId}`;
  await sql`delete from volunteers where id=${person}`;
  await sql`delete from units where name=${scope}`;
  await sql.end();
}
