import { randomBytes, createHash } from 'node:crypto';
import { registrationMailTemplate } from './registration-mail-template.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

/** Aviso interno en la misma transacción que la cancelación. */
export async function queueCoordinationCancellationMail(tx, id, reason, { origin, demo }) {
  const recipient = process.env.GRAPH_SENDER || (demo ? 'coordinacion@example.test' : '');
  if (!recipient) throw new Error('Falta configurar GRAPH_SENDER para avisar a Coordinación.');
  const [entry] = await tx`select v.name,v.surname,v.second_surname,o.title,o.location,o.id as outing_id,
    r.starts::text,r.ends::text from registrations r join volunteers v on v.id=r.volunteer_id
    join outings o on o.id=r.outing_id where r.id=${id}`;
  if (!entry) return;
  const name = [entry.name,entry.surname,entry.second_surname].filter(Boolean).join(' ');
  const url = `${origin}/coordinacion/salidas/${entry.outing_id}#inscripcion-${id}`;
  const subject = `ASVO · Cancelación por voluntariado · ${entry.title}`;
  const details = `${name} canceló su inscripción.\nConvocatoria: ${entry.title}\nLugar: ${entry.location}\nFechas: ${entry.starts} al ${entry.ends}\nMotivo: ${reason}`;
  const body = `${details}\n\nRevisá la inscripción y los cupos actualizados en Coordinación:\n${url}`;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const html = `<html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#080907;background:#f3f5ef;padding:20px"><table role="presentation" width="100%" style="max-width:620px;margin:auto;background:#fefefe;border:1px solid #d4d8d0"><tr><td style="padding:24px;border-bottom:4px solid #658048"><img src="${escape(new URL('/logo-asvo.png',origin).href)}" width="160" alt="ASVO"></td></tr><tr><td style="padding:24px"><h1 style="font-size:24px;color:#526a3d">Cancelación de inscripción</h1><p style="line-height:1.7">${escape(details).replace(/\n/g,'<br>')}</p><p><a href="${escape(url)}" style="display:inline-block;padding:12px 20px;background:#526a3d;color:#ffffff;text-decoration:none">Ver en Coordinación</a></p><p style="font-size:12px;color:#6f716d">Requiere iniciar sesión con permisos de Coordinación.</p></td></tr></table></body></html>`;
  if (demo) await tx`insert into demo_mail(recipient,url,subject,body) values (${recipient},${url},${subject},${body})`;
  else await tx`insert into registration_mail_outbox(registration_id,recipient,url,subject,body,html_body)
    values (${id},${recipient},${url},${subject},${body},${html})`;
}

/**
 * @param {import('postgres').TransactionSql} tx
 * @param {string} id
 * @param {string} message
 * @param {{ origin: string; demo: boolean; managementHours?: number }} options
 */
export async function queueRegistrationMail(tx, id, message, { origin, demo, managementHours = 72 }) {
  const [entry] = await tx`select r.status,r.starts::text,r.ends::text,v.email,v.name,v.surname,v.second_surname,
    o.title,o.location,o.unit,o.ends::text as outing_end
    from registrations r join volunteers v on v.id=r.volunteer_id join outings o on o.id=r.outing_id where r.id=${id}`;
  if (!entry?.email) return;
  let url = '';
  if (!entry.status.startsWith('cancelada')) {
    const token = randomBytes(32).toString('base64url');
    await tx`insert into links(digest,registration_id,purpose,expires)
      values (${digest(token)},${id},'gestionar',greatest(now()+${managementHours}*interval '1 hour',
        (greatest(${entry.ends}::date,${entry.outing_end}::date)+7)::timestamp at time zone 'America/Costa_Rica'))`;
    url = `${origin}/privado/${token}`;
  }
  const { subject, body, html } = registrationMailTemplate({ entry, message, url, origin });
  if (demo) {
    await tx`insert into demo_mail(recipient,url,subject,body) values (${entry.email},${url},${subject},${body})`;
  } else {
    await tx`insert into registration_mail_outbox(registration_id,recipient,url,subject,body,html_body)
      values (${id},${entry.email},${url},${subject},${body},${html})`;
  }
}

