import { randomBytes, createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');

/**
 * @param {import('postgres').TransactionSql} tx
 * @param {string} id
 * @param {string} message
 * @param {{ origin: string; demo: boolean; managementHours?: number }} options
 */
export async function queueRegistrationMail(tx, id, message, { origin, demo, managementHours = 72 }) {
  const [entry] = await tx`select r.status,r.starts::text,r.ends::text,v.email,o.title,o.ends::text as outing_end
    from registrations r join volunteers v on v.id=r.volunteer_id join outings o on o.id=r.outing_id where r.id=${id}`;
  if (!entry?.email) return;
  const token = randomBytes(32).toString('base64url');
  await tx`insert into links(digest,registration_id,purpose,expires)
    values (${digest(token)},${id},'gestionar',greatest(now()+${managementHours}*interval '1 hour',
      (greatest(${entry.ends}::date,${entry.outing_end}::date)+7)::timestamp at time zone 'America/Costa_Rica'))`;
  const url = `${origin}/privado/${token}`;
  const labels = { revisión: 'En revisión · con cupo reservado', espera: 'Lista de espera',
    confirmada: 'Confirmada', rechazada: 'Rechazada', 'cancelada por coordinación': 'Cancelada por Coordinación',
    'cancelada por voluntariado': 'Cancelada por voluntariado' };
  const subject = `ASVO · ${entry.title} · ${labels[entry.status] ?? entry.status}`;
  const body = `${entry.title}\nEstado: ${labels[entry.status] ?? entry.status}\n${message}\nFechas de participación: ${entry.starts} al ${entry.ends}\nConsultá tu inscripción y las opciones disponibles para editar o cancelar:\n${url}`;
  if (demo) {
    await tx`insert into demo_mail(recipient,url,subject,body) values (${entry.email},${url},${subject},${body})`;
  } else {
    await tx`insert into registration_mail_outbox(registration_id,recipient,url,subject,body)
      values (${id},${entry.email},${url},${subject},${body})`;
  }
}

