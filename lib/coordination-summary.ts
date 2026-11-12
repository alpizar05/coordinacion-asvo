import { sql } from './db';
import { registrationToday } from './outing-invitations';

export async function coordinationSummary(general: boolean, scopes: string[], unit: string, days: number) {
  const allowed = sql`(${general} or o.unit=any(${scopes}::text[])) and (${unit}='' or o.unit=${unit})`;
  const reviews = await sql`select r.id,md5(to_jsonb(r)::text) as version,r.identification,r.status,r.starts::text,r.ends::text,r.received_at,r.details,
    concat_ws(' ',v.name,v.surname,v.second_surname) as volunteer,o.id as outing_id,o.title,o.unit,o.flexible,
    o.starts::text as outing_start,o.ends::text as outing_end,
    (o.starts-${registrationToday})::int as days_to_start,
    (${registrationToday}-(r.received_at at time zone 'America/Costa_Rica')::date)::int as age,
    count(*) over()::int as total
    from registrations r join outings o on o.id=r.outing_id left join volunteers v on v.id=r.volunteer_id
    where ${allowed} and r.status='revisión' and o.status in ('abierta','confirmada')
    order by (o.starts<=${registrationToday}+1) desc,r.received_at,r.id limit 100`;
  const upcoming = await sql`select o.id,o.title,o.unit,o.starts::text,o.ends::text,o.capacity,
    (o.starts-${registrationToday})::int as days_to_start,
    count(r.id) filter(where r.status in ('revisión','confirmada'))::int as occupied,
    count(r.id) filter(where r.status='espera')::int as waiting,
    count(r.id) filter(where r.status='confirmada')::int as confirmed,
    coalesce(string_agg(concat_ws(' ',v.name,v.surname,v.second_surname),', ' order by r.received_at)
      filter(where r.status='confirmada' and r.details->'assigned70'='true'::jsonb),'') as leads,
    count(r.id) filter(where r.status='confirmada' and r.details->'interes70'='true'::jsonb)::int as interested,
    count(r.id) filter(where r.status='confirmada' and r.details->'transporte'='true'::jsonb)::int as drivers,
    count(*) over()::int as total
    from outings o left join registrations r on r.outing_id=o.id left join volunteers v on v.id=r.volunteer_id
    where ${allowed} and o.status in ('abierta','confirmada') and o.starts>=${registrationToday}
      and o.starts<${registrationToday}+${days}::int
    group by o.id order by o.starts,o.id`;
  const reports = await sql`select o.id,o.title,o.unit,o.starts::text,o.ends::text,(${registrationToday}-o.ends)::int as age,
    (select count(*)::int from registrations r where r.outing_id=o.id and r.status='confirmada'
      and r.details->'assigned70'='true'::jsonb and not exists(select 1 from outing_reports p where p.status='finalizado' and p.outing_id=o.id and p.lead_registration_id=r.id)) as missing,
    count(*) over()::int as total
    from outings o where ${allowed} and o.status in ('abierta','confirmada','completada') and o.ends<${registrationToday}
      and (exists(select 1 from registrations r where r.outing_id=o.id and r.status='confirmada'
        and r.details->'assigned70'='true'::jsonb and not exists(select 1 from outing_reports p where p.status='finalizado' and p.outing_id=o.id and p.lead_registration_id=r.id))
        or (not exists(select 1 from registrations r where r.outing_id=o.id and r.status='confirmada' and r.details->'assigned70'='true'::jsonb)
          and not exists(select 1 from outing_reports p where p.status='finalizado' and p.outing_id=o.id)))
    order by o.ends,o.id limit 100`;
  const reportPeople = reports.length ? await sql`select o.id as outing_id,r.id,concat_ws(' ',v.name,v.surname,v.second_surname) as name,v.email,
    exists(select 1 from outing_reports p where p.status='finalizado' and p.outing_id=o.id and p.lead_registration_id=r.id) as submitted,
    exists(select 1 from outing_reports p where p.status='borrador' and p.outing_id=o.id and p.lead_registration_id=r.id) as draft,
    exists(select 1 from outing_brief_links l where l.outing_id=o.id and l.lead_registration_id=r.id
      and l.revoked_at is null and l.expires_at>clock_timestamp()) as active_link,
    q.created_at as reminded_at,q.actor as reminded_by,m.sent_at,m.cancelled_at,m.id as mail_id,q.demo_mail_id,
    exists(select 1 from report_reminders pending join registration_mail_outbox pm on pm.id=pending.mail_id
      where pending.registration_id=r.id and pm.sent_at is null and pm.cancelled_at is null) as pending
    from outings o join registrations r on r.outing_id=o.id join volunteers v on v.id=r.volunteer_id
    left join lateral (select * from report_reminders where registration_id=r.id order by id desc limit 1) q on true
    left join registration_mail_outbox m on m.id=q.mail_id
    where o.id=any(${reports.map(row=>row.id)}::uuid[]) and r.status='confirmada' and r.details->'assigned70'='true'::jsonb
    order by o.id,v.name,v.surname,r.id` : [];
  return { reviews,upcoming,reports,reportPeople };
}
