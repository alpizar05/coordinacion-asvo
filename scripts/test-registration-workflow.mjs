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
  const results = await Promise.all(people.slice(0,3).map(receive));
  assert.equal(results.filter(row => row.status === 'revisión').length,2,'Dos reservas para dos cupos, aun con recepción concurrente');
  assert.equal(results.filter(row => row.status === 'espera').length,1);
  assert.equal((await receive(people[0])).duplicate,true,'La repetición no crea otra reserva');
  const entries = await sql`select id,status from registrations where outing_id=${outingId} order by received_at,id`;
  const reserved = entries.filter(row => row.status === 'revisión');
  const firstWaiter = entries.find(row => row.status === 'espera');
  assert.equal(await locked(tx => changeRegistrationStatus(tx,reserved[0].id,'prueba','confirmar','','2030-01-10/2030-01-12')),undefined);
  assert.ok(await locked(tx => assignRegistration70(tx,firstWaiter.id,'prueba',true)), 'No se asigna 70 a una inscripción en espera');
  assert.equal(await locked(tx => assignRegistration70(tx,reserved[0].id,'prueba',true)),undefined);
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
  const savedReport = await locked(tx => saveOutingReport(tx,briefToken,reportValues,[reserved[0].id],true,[reserved[0].id]));
  assert.ok(savedReport.id,'El 70 presenta su informe mediante el enlace privado');
  const [report] = await readOutingReports(outingId);
  assert.equal(report.participants[0].attended,true);
  assert.deepEqual(report.labour_types,['BRIF','Mantenimiento y otros'],'Se conservan varias labores seleccionadas');
  assert.ok(validateReport({ ...reportValues, labour: [] },[reserved[0].id],true).labour);
  assert.ok(validateReport({ ...reportValues, labour: ['Inventado'] },[reserved[0].id],true).labour);
  assert.ok(validateReport({ ...reportValues, activity: 'Inventado' },[reserved[0].id],true).activity);
  assert.equal(report.lead_registration_id,reserved[0].id,'La identidad proviene del enlace y no del formulario');
  await locked(tx => saveOutingReport(tx,briefToken,{ ...reportValues, observations: 'Corrección del 70' },[reserved[0].id],true,[reserved[0].id]));
  assert.equal((await readOutingReports(outingId)).length,1,'Reenviar actualiza el mismo informe');

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
  rows = await sql`select id,status from registrations where outing_id=${outingId}`;
  assert.equal(rows.find(row => row.id === reserved[0].id).status,'revisión','La lista conserva su prioridad por recepción');
  assert.equal(await locked(tx => occupiedSeats(tx,outingId)),2);

  const [mail] = await sql`select url,subject,body from demo_mail where recipient like ${emailPrefix + '%'} order by id desc limit 1`;
  assert.ok(mail.subject && mail.body.includes('Estado:') && mail.body.includes('/privado/'));
  const [privateMail] = await sql`select d.url from demo_mail d join volunteers v on v.email=d.recipient
    join registrations r on r.volunteer_id=v.id where r.id=${firstWaiter.id} order by d.id desc limit 1`;
  const token = new URL(privateMail.url).pathname.split('/').at(-1);
  const cancel = new FormData(); cancel.set('action','cancelar'); cancel.set('reason','Cancelación de prueba');
  await redirectAction(token,cancel);
  assert.equal(await locked(tx => occupiedSeats(tx,outingId)),1,'La cancelación libera el cupo');
  assert.equal((await receive(people[3])).status,'revisión','El cupo liberado queda disponible para otra persona');

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
