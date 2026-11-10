import { sql } from './db';
import { digest } from './registration';

export async function outingBrief(id: string) {
  const [outing] = await sql`select id,title,location,unit,status,starts::text,ends::text,requirements,logistics,transport_details,food_details,lodging_details,flexible
    from outings where id=${id}`;
  if (!outing) return;
  const people = await sql<{ id: string; starts: string; ends: string; details: Record<string, unknown>;
    name: string; whatsapp: string | null; covered: boolean }[]>`select r.id,r.starts::text,r.ends::text,r.details,
    concat_ws(' ',v.name,v.surname,v.second_surname) as name,v.whatsapp,
    exists(select 1 from policies p where p.volunteer_id=v.id and p.verified_at is not null and p.starts<=r.starts and p.ends>=r.ends) as covered
    from registrations r join volunteers v on v.id=r.volunteer_id
    where r.outing_id=${id} and r.status='confirmada' order by r.starts,v.name,v.surname,r.id`;
  return { outing, people };
}

export async function briefAccess(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return;
  const [access] = await sql`select l.outing_id,l.lead_registration_id,l.expires_at from outing_brief_links l
    join registrations r on r.id=l.lead_registration_id and r.outing_id=l.outing_id
    join outings o on o.id=l.outing_id
    where l.digest=${digest(token)} and l.revoked_at is null and l.expires_at>clock_timestamp()
      and r.status='confirmada' and r.details->'assigned70'='true'::jsonb
      and o.status in ('abierta','confirmada','completada')`;
  return access;
}
