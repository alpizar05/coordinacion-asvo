'use server';

import { dispatchRegistrationUpdates, notifyRegistration, promoteWaitlist, receiveRegistration } from '../lib/registration-workflow';

import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { activeOutingInvitation, registrationToday } from '../lib/outing-invitations';
import { sql, appUrl, demo } from '../lib/db';
import { queueCoordinationCancellationMail } from '../lib/registration-mail.mjs';
import { createRegistrationReceipt, receiptCookie } from '../lib/registration-receipt';
import { audit, cancellationWarning, date, digest, eligible, field, identification, uuid } from '../lib/registration';

export async function register(outingId: string, schedule: string, token: string, form: FormData) {
  if (!uuid(outingId)) return;
  const header = await headers();
  const ip = header.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const idNumber = identification(field(form,'identification'));
  const slot = Math.floor(Date.now() / 900000);
  const message = await sql.begin(async tx => {
    const buckets = [[digest('ip:' + ip), 30], [digest('id:' + idNumber), 8]] as const;
    for (const [bucket, limit] of buckets) {
      const [attempt] = await tx`insert into attempts values (${bucket},${slot},1)
        on conflict (bucket,slot) do update set count=attempts.count+1 returning count`;
      if (attempt.count > limit) return 'limite';
    }
    const [outing] = await tx`select *, starts::text as first_day, ends::text as last_day,
      coalesce(registration_deadline,starts) >= ${registrationToday} as accepting
      from outings where id=${outingId} and status in ('abierta','confirmada') for update`;
    const invitation = await activeOutingInvitation(outingId, token, tx);
    if (!outing || (token && !invitation) || (!invitation && (outing.status !== 'abierta' || !outing.accepting))) return 'cerrada';
    if (!/^[A-Z0-9]{4,30}$/.test(idNumber)) return 'datos-invalidos';
    if (schedule !== `${outing.first_day}/${outing.last_day}/${outing.flexible}`) return 'fechas-actualizadas';
    const starts = outing.flexible ? field(form,'starts') : outing.first_day;
    const ends = outing.flexible ? field(form,'ends') : outing.last_day;
    if (!date(starts) || !date(ends) || ends < outing.first_day || starts > outing.last_day || ends < starts) return 'datos-invalidos';
    const [person] = await tx`select id,email from volunteers where identification=${idNumber}`;
    if (!person) return 'identificacion-no-encontrada';
    if (invitation && (!person.email || person.id !== invitation.volunteer_id || !await eligible(tx,person.id,outing.unit))) {
      return 'invitacion-invalida';
    }
    const [coverage] = await tx`select 1 from policies where volunteer_id=${person.id}
      and verified_at is not null and starts<=${starts}::date and ends>=${ends}::date limit 1`;
    if (!coverage) return 'poliza-no-encontrada';
    if (!person.email || !await eligible(tx,person.id,outing.unit)) return 'ficha-no-elegible';
    const registration = await receiveRegistration(tx, {
      outingId, volunteerId: person.id, identification: idNumber, starts, ends,
      details: registrationDetails(form, outing.unit === 'Voluntariado General'),
    });
    if (registration.duplicate) return 'duplicada';
    if (invitation) {
      await tx`update outing_invitations set used_at=clock_timestamp() where digest=${invitation.digest}`;
      await audit(tx, 'voluntariado', 'Usó invitación a salida', registration.id);
    }
    return { status: registration.status, receipt: await createRegistrationReceipt(tx,registration.id,registration.status) };
  });
  await dispatchRegistrationUpdates();
  const query = new URLSearchParams({ resultado: randomUUID() });
  if (token) query.set('invitacion', token);
  const back = `/convocatorias/${outingId}`;
  if (message === 'cerrada') redirect(back);
  if (typeof message === 'string') {
    if (message === 'fechas-actualizadas') query.set('fechas','1');
    else if (message === 'poliza-no-encontrada') query.set('poliza','1');
    else query.set('registroError',message);
    redirect(`${back}?${query}#inscripcion`);
  }
  (await cookies()).set(receiptCookie(outingId),message.receipt,{
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600,
  });
  query.delete('invitacion');
  query.set('recibido','1');
  redirect(`${back}?${query}#inscripcion`);
}

function registrationDetails(form: FormData, general: boolean) {
  const rides = Number(field(form,'rides'));
  return {
    transporte: field(form,'transport') === 'on',
    ofreceTransporte: field(form,'transport') === 'on' && Number.isSafeInteger(rides) && rides >= 0 ? rides : 0,
    alimentacion: field(form,'food').slice(0,500),
    interes70: general && field(form,'lead') === 'on',
    otro: field(form,'other').slice(0,500),
  };
}

export async function privateAction(token: string, form: FormData) {
  if (!/^[\w-]{43}$/.test(token)) return;
  const action = field(form,'action');
  const key = digest(token);
  const result = await sql.begin(async tx => {
    const [link] = await tx`select * from links where digest=${key} and expires > clock_timestamp()`;
    if (!link) return;
    const [entry] = await tx`select * from registrations where id=${link.registration_id}`;
    if (!['gestionar','validar'].includes(link.purpose)) return;
    const [outing] = await tx`select unit,status,flexible,starts::text as first_day,ends::text as last_day
      from outings where id=${entry.outing_id} for update`;
    const [current] = await tx`select status, outing_id, starts::text as first_day,ends::text as last_day,volunteer_id from registrations where id=${entry.id} for update`;
    if (!outing || !current || current.outing_id !== entry.outing_id || !['abierta','confirmada'].includes(outing.status)) return;
    const active = ['revisión','espera','confirmada'].includes(current.status);
    if (action === 'cancelar' && active) {
      if (cancellationWarning(current.first_day) && field(form,'acknowledge') !== 'on') return;
      if (!field(form,'reason')) return;
      await tx`update registrations set status='cancelada por voluntariado' where id=${entry.id}`;
      await audit(tx,'voluntariado','Canceló inscripción',entry.id,field(form,'reason'));
      await notifyRegistration(tx,entry.id,`Cancelaste tu inscripción. Motivo: ${field(form,'reason')}`);
      await queueCoordinationCancellationMail(tx,entry.id,field(form,'reason'),{ origin: appUrl(), demo });
      await promoteWaitlist(tx,entry.outing_id,'sistema');
    } else if (action === 'editar' && active) {
      const starts = outing.flexible ? field(form,'starts') : outing.first_day;
      const ends = outing.flexible ? field(form,'ends') : outing.last_day;
      if (!date(starts) || !date(ends) || ends < outing.first_day || starts > outing.last_day || starts > ends) return;
      const [coverage] = await tx`select id from policies where volunteer_id=${current.volunteer_id}
        and verified_at is not null and starts<=${starts}::date and ends>=${ends}::date limit 1`;
      if (!coverage || !await eligible(tx,current.volunteer_id,outing.unit)) return;
      const datesChanged = current.first_day !== starts || current.last_day !== ends;
      const status = current.status === 'confirmada' && datesChanged ? 'revisión' : current.status;
      const details = { ...registrationDetails(form,outing.unit === 'Voluntariado General'),
        ...(status === 'confirmada' && entry.details?.assigned70 === true ? { assigned70: true } : {}) };
      await tx`update registrations set details=${tx.json(details)},starts=${starts},ends=${ends},status=${status} where id=${entry.id}`;
      if (status !== 'confirmada') await tx`update outing_brief_links set revoked_at=now() where lead_registration_id=${entry.id} and revoked_at is null`;
      await audit(tx,'voluntariado','Editó inscripción',entry.id);
      await notifyRegistration(tx,entry.id,datesChanged && current.status === 'confirmada'
        ? 'Actualizaste tus fechas. Conservás el cupo reservado y Coordinación debe confirmar las fechas nuevas.'
        : 'Guardamos los cambios de tu inscripción.');
    } else return;
    return `/privado/${token}?actualizada=1`;
  });
  await dispatchRegistrationUpdates();
  redirect(result || `/privado/${token}?error=1`);
}
