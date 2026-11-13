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
const { registrationHistory } = await import('../lib/registration-history.ts');
const { sql } = await import('../lib/db.ts');
const { editStaffRegistration, registrationVersion } = await import('../lib/edit-registration.ts');
const { receiveStaffRegistration } = await import('../lib/staff-registration.ts');
const { assignRegistration70, receiveRegistration, changeRegistrationStatus, occupiedSeats } = await import('../lib/registration-workflow.ts');
const { saveOutingReport, readOutingReports, validateReport } = await import('../lib/outing-report.ts');
const { briefAccess, outingBrief } = await import('../lib/outing-brief.ts');
const { digest } = await import('../lib/registration.ts');
const { queueRegistrationMail } = await import('../lib/registration-mail.mjs');
const { flushRegistrationMail } = await import('../lib/mail-outbox.mjs');
const { privateAction } = await import('../app/public-actions.ts');
const requestId = randomUUID();
const outingId = randomUUID();
const people = Array.from({ length: 4 }, () => ({ id: randomUUID(), identification: randomUUID().replaceAll('-','').slice(0,20) }));
const emailPrefix = `test-${requestId}`;

async function locked(callback) {
  return sql.begin(async tx => {
    await tx`select id from outings where id=${outingId} for update`;
    return callback(tx);
  });
}
async function receive(person) {
  return locked(tx => receiveRegistration(tx,{ outingId, volunteerId: person.id, identification: person.identification,
    starts: '2030-01-10', ends: '2030-01-12', details: {} }));
}
async function redirectAction(token, form) {
  await assert.rejects(privateAction(token,form), error => error?.digest?.startsWith('NEXT_REDIRECT'));
}
try {
  await sql.begin(async tx => {
    await tx`insert into requests(id,organization,activity) values (${requestId},'Prueba automatizada','Prueba')`;
    await tx`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)
      values (${outingId},${requestId},'Prueba automatizada','Local','Voluntariado General','2030-01-10','2030-01-15',true,2,'abierta',false)`;
    for (const person of people) {
      await tx`insert into volunteers(id,identification,name,surname,email)
        values (${person.id},${person.identification},'Prueba','Prueba',${emailPrefix + '-' + person.id + '@example.test'})`;
      await tx`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)
        values (${person.id},'Prueba',${person.id},'2030-01-01','2030-02-01',now())`;
    }
  });
  const staffOuting = { id: outingId, unit: 'Voluntariado General', status: 'abierta', flexible: true, first_day: '2030-01-10', last_day: '2030-01-15' };
  const staffReceive = (person, overrides = {}, starts = '2030-01-10', ends = '2030-01-12') => locked(tx =>
    receiveStaffRegistration(tx,{ ...staffOuting,...overrides },'coordinador-prueba',person.id,starts,ends,{ transporte: true, ofreceTransporte: 2, alimentacion: 'Vegetariana' }));
  assert.ok((await staffReceive(people[0],{ status: 'cancelada' })).error);
  assert.ok((await staffReceive(people[0],{},'2030-02-01','2030-02-02')).fieldErrors.starts);
  assert.ok((await staffReceive(people[0],{ flexible: false })).fieldErrors.ends);
  assert.ok((await staffReceive(people[0],{ unit: 'BRIF' })).error);
  assert.ok((await staffReceive(people[0],{},'2029-12-31','2030-01-12')).error,'No incorpora sin cobertura para todo el periodo');
  const malformed=await locked(tx=>receiveStaffRegistration(tx,staffOuting,'coordinador-prueba',people[0].id,'invalid','2030-01-12',{transporte:true,ofreceTransporte:101,alimentacion:42}));
  for(const name of ['starts','rides','food'])assert.ok(malformed.fieldErrors[name]);
  const staffEntry = await staffReceive(people[0]);
  assert.equal(staffEntry.status,'revisión');
  assert.ok((await staffReceive(people[0])).error,'Coordinación tampoco duplica inscripciones');
  const [staffAudit] = await sql`select actor from audit where target=${staffEntry.id} and action='Agregó inscripción desde Coordinación'`;
  assert.equal(staffAudit.actor,'coordinador-prueba');
  const receivedHistory = await registrationHistory(staffEntry.id);
  assert.ok(receivedHistory.events.some(event=>event.action==='Recibió inscripción'));
  assert.ok(receivedHistory.mail.some(mail=>mail.source==='demo'),'Vincula correos de prueba sin adivinar por destinatario');
  assert.ok(!JSON.stringify(receivedHistory).includes('/privado/'),'No expone enlaces privados en el historial');
  assert.equal((await sql`select details from registrations where id=${staffEntry.id}`)[0].details.ofreceTransporte,2);
  const results = [staffEntry,...await Promise.all([receive(people[1]),staffReceive(people[2])])];
  assert.equal(results.filter(row => row.status === 'revisión').length,2,'Dos reservas para dos cupos, aun con recepción concurrente');
  assert.equal(results.filter(row => row.status === 'espera').length,1);
  assert.equal((await receive(people[0])).duplicate,true,'La repetición no crea otra reserva');
  const entries = await sql`select id,status from registrations where outing_id=${outingId} order by received_at,id`;
  const reserved = entries.filter(row => row.status === 'revisión');
  const firstWaiter = entries.find(row => row.status === 'espera');
  assert.equal(await locked(tx => changeRegistrationStatus(tx,reserved[0].id,'prueba','confirmar','','2030-01-10/2030-01-12')),undefined);
  assert.ok(await locked(tx => assignRegistration70(tx,firstWaiter.id,'prueba',true)), 'No se asigna 70 a una inscripción en espera');
  assert.equal(await locked(tx => assignRegistration70(tx,reserved[0].id,'prueba',true)),undefined);
  const editDetails = { transporte: true, ofreceTransporte: 3, alimentacion: 'Sin gluten', interes70: true, otro: 'Observación de prueba' };
  const editVersion = async () => registrationVersion((await sql`select starts::text,ends::text,status,details from registrations where id=${reserved[0].id}`)[0]);
  const originalVersion = await editVersion();
  const invalidEdit=await locked(tx=>editStaffRegistration(tx,reserved[0].id,'coordinador-prueba',originalVersion,'invalid','2030-01-12',{transporte:true,ofreceTransporte:101,otro:[]}));
  for(const name of ['starts','rides','other'])assert.ok(invalidEdit.fieldErrors[name]);
  assert.equal(await editVersion(),originalVersion,'Un error de campo no cambia datos ni versión');
  assert.ok((await locked(tx => editStaffRegistration(tx,reserved[0].id,'coordinador-prueba',originalVersion,'2030-01-10','2030-02-03',editDetails))).error,'Rechaza fechas sin cobertura');
  assert.equal((await locked(tx => editStaffRegistration(tx,reserved[0].id,'coordinador-prueba',originalVersion,'2030-01-10','2030-01-12',editDetails))).saved,true);
  assert.equal((await sql`select status,details from registrations where id=${reserved[0].id}`)[0].details.assigned70,true,'Editar logística conserva asignación 70');
  const editedHistory = await registrationHistory(reserved[0].id);
  assert.ok(editedHistory.events.some(event=>event.reason?.includes('Personas que puede llevar:') && event.reason?.includes('3')),'Registra valores anteriores y nuevos de logística');
  assert.ok((await locked(tx => editStaffRegistration(tx,reserved[0].id,'coordinador-prueba',originalVersion,'2030-01-10','2030-01-12',{}))).error,'No sobrescribe una versión desactualizada');
  assert.equal((await locked(async tx => editStaffRegistration(tx,reserved[0].id,'coordinador-prueba',await editVersion(),'2030-01-11','2030-01-12',editDetails))).saved,true);
  assert.equal((await sql`select status from registrations where id=${reserved[0].id}`)[0].status,'revisión','Cambiar fechas confirmadas exige nueva revisión');
  assert.equal(await locked(tx => occupiedSeats(tx,outingId)),2,'Cambiar fechas conserva el cupo');
  await locked(tx => changeRegistrationStatus(tx,reserved[0].id,'prueba','confirmar','',''));
  await locked(async tx => editStaffRegistration(tx,reserved[0].id,'coordinador-prueba',await editVersion(),'2030-01-10','2030-01-12',editDetails));
  await locked(tx => changeRegistrationStatus(tx,reserved[0].id,'prueba','confirmar','',''));
  await locked(tx => assignRegistration70(tx,reserved[0].id,'prueba',true));

  assert.equal((await sql`select details from registrations where id=${reserved[0].id}`)[0].details.assigned70,true);
  const briefToken = randomBytes(32).toString('base64url');
  await sql`insert into outing_brief_links(digest,outing_id,lead_registration_id,created_by)
    values (${digest(briefToken)},${outingId},${reserved[0].id},'prueba')`;
  assert.equal((await briefAccess(briefToken)).outing_id,outingId,'El 70 asignado puede consultar el resumen');
  assert.equal((await outingBrief(outingId)).people.length,1,'El resumen solo incluye inscripciones confirmadas');
  const reportValues = { labour: ['BRIF','Mantenimiento y otros'], location: 'Parque de prueba', activity: 'Salida BRIF',
    starts: '2030-01-10', ends: '2030-01-12', actions: 'Se limpiaron senderos.', host: 'Persona responsable de prueba', observations: '' };
  assert.ok(validateReport(reportValues,[],true).participants,'No se supone asistencia sin confirmarla');
  assert.ok(validateReport({ ...reportValues, ends: '2029-01-01' },[reserved[0].id],true).ends);
  assert.ok((await locked(tx => saveOutingReport(tx,briefToken,reportValues,[reserved[0].id],true,[]))).errors?.participants,'Detecta un cambio de lista');
  const incomplete = { labour: [], location: '', activity: '', starts: '', ends: '', actions: 'Avance guardado', host: '', observations: '' };
  const draft = await locked(tx => saveOutingReport(tx,briefToken,incomplete,[],false,[reserved[0].id],'borrador'));
  assert.ok(draft.id,'Guarda un borrador incompleto sin confirmar asistencia');
  const [draftReport] = await readOutingReports(outingId);
  assert.equal(draftReport.status,'borrador');
  assert.equal(draftReport.submitted_at,null);
  assert.equal(draftReport.starts,'');
  assert.ok((await locked(tx => saveOutingReport(tx,briefToken,incomplete,[],false,[reserved[0].id],'finalizar'))).errors,'No finaliza campos incompletos');
  assert.equal((await locked(tx => saveOutingReport(tx,briefToken,{...incomplete,observations:'Nuevo avance'},[],false,[reserved[0].id],'borrador'))).id,draft.id,'Retoma el mismo borrador');
  const savedReport = await locked(tx => saveOutingReport(tx,briefToken,reportValues,[reserved[0].id],true,[reserved[0].id]));
  assert.ok(savedReport.id,'El 70 presenta su informe mediante el enlace privado');
  const [report] = await readOutingReports(outingId);
  assert.equal(report.participants[0].attended,true);
  assert.deepEqual(report.labour_types,['BRIF','Mantenimiento y otros'],'Se conservan varias labores seleccionadas');
  assert.ok(validateReport({ ...reportValues, labour: [] },[reserved[0].id],true).labour);
  assert.ok(validateReport({ ...reportValues, labour: ['Inventado'] },[reserved[0].id],true).labour);
  assert.ok(validateReport({ ...reportValues, activity: 'Inventado' },[reserved[0].id],true).activity);
  assert.equal(report.lead_registration_id,reserved[0].id,'La identidad proviene del enlace y no del formulario');
  assert.equal(report.status,'finalizado');
  assert.ok(report.submitted_at);
  assert.ok((await locked(tx => saveOutingReport(tx,briefToken,{ ...reportValues, observations: 'Corrección del 70' },[reserved[0].id],true,[reserved[0].id]))).errors?.form,'No edita informes finalizados');
  assert.ok((await locked(tx => saveOutingReport(tx,briefToken,reportValues,[],false,[reserved[0].id],'borrador'))).errors?.form,'No convierte un informe finalizado en borrador');
  assert.equal((await readOutingReports(outingId))[0].observations,'','El informe finalizado queda intacto');

  assert.equal(await briefAccess('token-invalido'),undefined);
  await sql`update outing_brief_links set expires_at=now()-interval '1 second' where digest=${digest(briefToken)}`;
  assert.equal(await briefAccess(briefToken),undefined,'Los enlaces vencidos no permiten consultar datos');
  await sql`update outing_brief_links set expires_at=now()+interval '7 days' where digest=${digest(briefToken)}`;

  assert.equal(await locked(tx => assignRegistration70(tx,reserved[0].id,'prueba',false)),undefined);
  assert.equal((await sql`select details from registrations where id=${reserved[0].id}`)[0].details.assigned70,false);
  await locked(tx => assignRegistration70(tx,reserved[0].id,'prueba',true));
  assert.equal(await briefAccess(briefToken),undefined,'Quitar y reasignar 70 no reactiva un enlace revocado');
  assert.ok((await locked(tx => saveOutingReport(tx,briefToken,reportValues,[reserved[0].id],true,[reserved[0].id]))).errors?.form,'Un enlace revocado no puede presentar informes');
  assert.ok(await locked(tx => changeRegistrationStatus(tx,reserved[0].id,'prueba','espera','','')),'Mover a espera requiere motivo');
  assert.equal(await locked(tx => changeRegistrationStatus(tx,reserved[0].id,'prueba','espera','Cambio de coordinación','')),undefined);
  assert.equal((await sql`select details from registrations where id=${reserved[0].id}`)[0].details.assigned70,undefined,'Mover a espera retira la asignación de 70');
  let rows = await sql`select id,status from registrations where outing_id=${outingId}`;
  assert.equal(rows.find(row => row.id === reserved[0].id).status,'espera','La persona movida no recupera inmediatamente su cupo');
  assert.equal(rows.find(row => row.id === firstWaiter.id).status,'revisión','La siguiente persona ocupa el cupo');
  assert.equal(await locked(tx => changeRegistrationStatus(tx,reserved[1].id,'prueba','rechazar','Rechazo de prueba','')),undefined);
  assert.ok((await locked(tx => editStaffRegistration(tx,reserved[1].id,'coordinador-prueba','anterior','2030-01-10','2030-01-12',{}))).error,'No edita inscripciones rechazadas');
  rows = await sql`select id,status from registrations where outing_id=${outingId}`;
  assert.equal(rows.find(row => row.id === reserved[0].id).status,'revisión','La lista conserva su prioridad por recepción');
  assert.equal(await locked(tx => occupiedSeats(tx,outingId)),2);

  const [mail] = await sql`select url,subject,body from demo_mail where recipient like ${emailPrefix + '%'} order by id desc limit 1`;
  assert.ok(mail.subject && mail.body.includes('Estado:') && mail.body.includes('/privado/'));
  const [privateMail] = await sql`select d.url from demo_mail d join volunteers v on v.email=d.recipient
    join registrations r on r.volunteer_id=v.id where r.id=${firstWaiter.id} order by d.id desc limit 1`;
  const token = new URL(privateMail.url).pathname.split('/').at(-1);
  const cancel = new FormData(); cancel.set('action','cancelar'); cancel.set('reason','Cancelación de prueba');
  const [beforeCancel] = await sql`select count(*)::int as count from links where registration_id=${firstWaiter.id}`;
  await redirectAction(token,cancel);
  const [coordinationMail] = await sql`select * from demo_mail where recipient=${process.env.GRAPH_SENDER || 'coordinacion@example.test'}
    and subject like 'ASVO · Cancelación por voluntariado%' order by id desc limit 1`;
  assert.ok(coordinationMail.body.includes('Cancelación de prueba'));
  assert.ok(coordinationMail.url.includes('/coordinacion/salidas/'));
  const [afterCancel] = await sql`select count(*)::int as count from links where registration_id=${firstWaiter.id}`;
  assert.equal(afterCancel.count,beforeCancel.count,'Cancelar no genera enlaces privados nuevos');
  const [volunteerCancellation] = await sql`select * from demo_mail where recipient like ${emailPrefix + '%'} order by id desc limit 1`;
  assert.equal(volunteerCancellation.url,'');
  assert.doesNotMatch(volunteerCancellation.body,/\/privado\//);
  assert.equal(await locked(tx => changeRegistrationStatus(tx,firstWaiter.id,'prueba','confirmar','','')),undefined,
    'Coordinación puede confirmar una inscripción cancelada por voluntariado');
  assert.equal(await locked(tx => changeRegistrationStatus(tx,firstWaiter.id,'prueba','cancelar','Prueba de nueva cancelación','')),undefined);
  assert.ok((await locked(tx => editStaffRegistration(tx,firstWaiter.id,'coordinador-prueba','anterior','2030-01-10','2030-01-12',{}))).error,'No edita inscripciones canceladas');
  await sql`update policies set verified_at=null where volunteer_id=(select volunteer_id from registrations where id=${firstWaiter.id})`;
  assert.match(await locked(tx => changeRegistrationStatus(tx,firstWaiter.id,'prueba','confirmar','','')),/póliza/);
  await sql`update policies set verified_at=now() where volunteer_id=(select volunteer_id from registrations where id=${firstWaiter.id})`;
  assert.equal(await locked(tx => changeRegistrationStatus(tx,firstWaiter.id,'prueba','confirmar','','')),undefined,
    'También puede confirmar una inscripción cancelada por coordinación');
  await locked(tx => changeRegistrationStatus(tx,firstWaiter.id,'prueba','cancelar','Restablecer escenario',''));
  assert.equal(await locked(tx => occupiedSeats(tx,outingId)),1,'La cancelación libera el cupo');
  assert.equal((await receive(people[3])).status,'revisión','El cupo liberado queda disponible para otra persona');
  assert.match(await locked(tx => changeRegistrationStatus(tx,firstWaiter.id,'prueba','confirmar','','')),/cupos están ocupados/);

  assert.equal(await locked(tx => changeRegistrationStatus(tx,reserved[0].id,'prueba','confirmar','','')),undefined);
  const [editMail] = await sql`select d.url from demo_mail d join volunteers v on v.email=d.recipient
    join registrations r on r.volunteer_id=v.id where r.id=${reserved[0].id} order by d.id desc limit 1`;
  const edit = new FormData(); edit.set('action','editar'); edit.set('starts','2030-01-11'); edit.set('ends','2030-01-12');
  await redirectAction(new URL(editMail.url).pathname.split('/').at(-1),edit);
  const [edited] = await sql`select status from registrations where id=${reserved[0].id}`;
  assert.equal(edited.status,'revisión','Editar fechas confirmadas conserva reserva y requiere nueva confirmación');
  assert.equal(await locked(tx => occupiedSeats(tx,outingId)),2);
  await locked(async tx => {
    assert.equal((await tx`select id from registration_mail_outbox where sent_at is null`).length,0,
      'La prueba del envío requiere una cola local sin mensajes pendientes');
    await queueRegistrationMail(tx,reserved[0].id,'Aviso de prueba',{ origin: process.env.APP_URL, demo: false });
    const originalFetch = globalThis.fetch;
    try {
      // Exercise Graph retries with a reserved non-deliverable domain; .test recipients are intentionally cancelled before Graph.
      await tx`update registration_mail_outbox set recipient='mock@example.invalid' where registration_id=${reserved[0].id} and sent_at is null`;
      globalThis.fetch = async () => new Response('',{status:503});
      await flushRegistrationMail(tx);
      const [pending] = await tx`select id,sent_at,attempts from registration_mail_outbox where registration_id=${reserved[0].id}`;
      assert.equal(pending.sent_at,null,'Un fallo de Graph conserva el correo pendiente');
      assert.equal(pending.attempts,1);
      await tx`update registration_mail_outbox set retry_at=now() where id=${pending.id}`;
      globalThis.fetch = async (url, options) => {
        if (String(url).includes('/token')) return Response.json({ access_token: 'mock' });
        const { message } = JSON.parse(options.body);
        assert.equal(message.body.contentType,'HTML');
        assert.match(message.body.content,/Ver mi inscripción/);
        return new Response('',{status:202});
      };
      await flushRegistrationMail(tx);
      const [sent] = await tx`select sent_at from registration_mail_outbox where id=${pending.id}`;
      assert.ok(sent.sent_at,'Un reintento exitoso registra la entrega');
    } finally { globalThis.fetch = originalFetch; }
  });
  console.log('OK: recepción concurrente, duplicados, confirmación, motivos, promociones, correos, enlace privado, cancelación, edición y reintentos de correo.');
} finally {
  await sql.begin(async tx => {
    await tx`delete from demo_mail where recipient like ${emailPrefix + '%'}`;
    await tx`delete from links where registration_id in (select id from registrations where outing_id=${outingId})`;
    await tx`delete from registration_mail_outbox where registration_id in (select id from registrations where outing_id=${outingId})`;
    await tx`delete from audit where target=${outingId}::text or target in (select id::text from registrations where outing_id=${outingId})`;
    await tx`delete from registrations where outing_id=${outingId}`;
    await tx`delete from policies where volunteer_id=any(${people.map(person => person.id)}::uuid[])`;
    await tx`delete from volunteers where id=any(${people.map(person => person.id)}::uuid[])`;
    await tx`delete from outings where id=${outingId}`;
    await tx`delete from requests where id=${requestId}`;
  });
  await sql.end();
}
