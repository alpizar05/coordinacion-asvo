import { sql } from './db';

export async function registrationHistory(id: string) {
  const events = await sql<{id:string;actor:string;action:string;reason:string|null;happened_at:Date}[]>`
    select id::text,actor,action,reason,happened_at from audit where target=${id} order by happened_at,id`;
  const mail = await sql<{id:string;recipient:string;subject:string;created_at:Date|null;sent_at:Date|null;cancelled_at:Date|null;attempts:number;retry_at:Date|null;source:string}[]>`
    select id::text,recipient,subject,created_at,sent_at,cancelled_at,attempts,retry_at,'correo' as source
    from registration_mail_outbox where registration_id=${id}
    union all
    select id::text,recipient,coalesce(subject,'Correo de prueba'),created_at,null,null,0,null,'demo' as source
    from demo_mail where registration_id=${id}
    order by created_at nulls last,id`;
  return { events: events.map(event=>({...event,happened_at:event.happened_at.toISOString()})),
    mail: mail.map(message=>({...message,created_at:message.created_at?.toISOString() || null,sent_at:message.sent_at?.toISOString() || null,
      cancelled_at:message.cancelled_at?.toISOString() || null,retry_at:message.retry_at?.toISOString() || null})) };
}
