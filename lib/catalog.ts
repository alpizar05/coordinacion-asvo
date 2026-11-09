import { registrationToday } from './outing-invitations';
import { sql } from './db';

export function listedOutings(requestId?: string, collectionId?: string) {
  return sql<{ id: string; request_id: string; title: string; general_title: string | null; has_blocks: boolean; location: string; unit: string;
    capacity: number; occupied: number; starts: string; ends: string; flexible: boolean; photo_id: string | null; alt: string | null }[]>`
    select o.id,o.request_id,o.title,r.outing_defaults->>'title' as general_title,o.location,o.unit,o.starts::text,o.ends::text,o.flexible,o.capacity,
      (select count(*)::int from registrations where outing_id=o.id and status in ('revisión','confirmada')) as occupied,p.id as photo_id,p.alt
      ,exists(select 1 from outings sibling where sibling.request_id=o.request_id and sibling.id<>o.id) as has_blocks
    from outings o join requests r on r.id=o.request_id left join outing_photos p on p.outing_id=o.id and p.position=1
    where o.status='abierta' and o.listed
      and coalesce(o.registration_deadline,o.starts) >= ${registrationToday}
      ${requestId ? sql`and o.request_id=${requestId}` : sql``}
      ${collectionId ? sql`and exists (
        select 1 from outing_collection_members m where m.collection_id=${collectionId} and m.outing_id=o.id
      )` : sql``}
    order by o.starts,o.id`;
}

export function publicCollectionMembers() {
  return sql<{ id: string; name: string; outing_id: string }[]>`
    select c.id,c.name,m.outing_id
    from outing_collections c join outing_collection_members m on m.collection_id=c.id
    join outings o on o.id=m.outing_id
    where o.status='abierta' and o.listed
      and coalesce(o.registration_deadline,o.starts) >= ${registrationToday}
    order by o.starts,o.id,c.id`;
}
