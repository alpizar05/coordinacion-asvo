import { randomBytes } from 'node:crypto';
import { appUrl, demo } from './db';
import { audit, digest, type Transaction } from './registration';
import { reportReminderTemplate } from './report-reminder-template.mjs';

// Caller holds the outing row lock and authorizes the current unit.
export async function queueReportReminder(tx: Transaction, outingId: string, registrationId: string, actor: string, expectedEmail: string, options: { isDemo?: boolean } = {}) {
  const [entry] = await tx`select r.id,r.status,r.details,v.email,concat_ws(' ',v.name,v.surname,v.second_surname) as name,
    o.title,o.starts::text,o.ends::text,o.status as outing_status,
    o.ends<(clock_timestamp() at time zone 'America/Costa_Rica')::date as ended
    from registrations r join volunteers v on v.id=r.volunteer_id join outings o on o.id=r.outing_id
    where r.id=${registrationId} and o.id=${outingId} for update of r`;
  if (!entry || !entry.ended || !['abierta','confirmada','completada'].includes(entry.outing_status) || entry.status !== 'confirmada' || entry.details?.assigned70 !== true) return { error: 'La salida o la asignación de 70 cambió. Actualizá el seguimiento.' };
  if (!entry.email || entry.email !== expectedEmail) return { error: 'El correo de la ficha cambió o no está registrado. Volvé a abrir el recordatorio.' };
  if ((await tx`select 1 from outing_reports where status='finalizado' and outing_id=${outingId} and lead_registration_id=${registrationId}`).length) return { error: 'Esta persona ya presentó el informe.' };
  const [pending] = await tx`select 1 from report_reminders q join registration_mail_outbox m on m.id=q.mail_id
    where q.registration_id=${registrationId} and m.sent_at is null and m.cancelled_at is null limit 1`;
  if (pending) return { error: 'Ya hay un recordatorio pendiente de envío. Se reintentará automáticamente.' };
  // Digest-only links generated manually cannot be recovered. Create a fresh link without revoking shared valid links.
  const [reusable] = await tx`select coalesce(m.url,d.url) as url,l.digest from report_reminders q
    join outing_brief_links l on l.digest=q.link_digest left join registration_mail_outbox m on m.id=q.mail_id
    left join demo_mail d on d.id=q.demo_mail_id where q.registration_id=${registrationId}
    and l.outing_id=${outingId} and l.revoked_at is null and l.expires_at>clock_timestamp()+interval '1 day'
    order by q.id desc limit 1`;
  let linkDigest = reusable?.digest, url = reusable?.url;
  if (!url) {
    const token = randomBytes(32).toString('base64url'); linkDigest = digest(token);
    await tx`insert into outing_brief_links(digest,outing_id,lead_registration_id,created_by)
      values (${linkDigest},${outingId},${registrationId},${actor})`;
    url = `${appUrl()}/resumen-salida/${token}/informe`;
  }
  const mail = reportReminderTemplate({name:entry.name,title:entry.title,starts:entry.starts,ends:entry.ends,url,origin:appUrl()});
  let mailId = null, demoId = null;
  if (options.isDemo ?? demo) {
    const [row] = await tx`insert into demo_mail(registration_id,recipient,url,subject,body) values (${registrationId},${entry.email},${url},${mail.subject},${mail.body}) returning id`; demoId = row.id;
  } else {
    const [row] = await tx`insert into registration_mail_outbox(registration_id,recipient,url,subject,body,html_body)
      values (${registrationId},${entry.email},${url},${mail.subject},${mail.body},${mail.html}) returning id`; mailId = row.id;
  }
  await tx`insert into report_reminders(registration_id,link_digest,actor,recipient,mail_id,demo_mail_id)
    values (${registrationId},${linkDigest},${actor},${entry.email},${mailId},${demoId})`;
  await audit(tx,actor,'Solicitó recordatorio de informe',outingId,`Inscripción: ${registrationId}`);
  return { saved: true };
}
