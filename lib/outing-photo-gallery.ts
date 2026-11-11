import { canOperate, type staff } from './auth';
import { sql } from './db';

export type GalleryPhoto = { id: string; alt: string; credit?: string; title: string; location: string };

export function outingPhotoGallery(user: Awaited<ReturnType<typeof staff>>, excludeOuting?: string) {
  const scopes = user?.grants.filter(grant => grant.role === 'unidad').map(grant => grant.unit) ?? [];
  return sql<GalleryPhoto[]>`
    select id,alt,credit,title,location from (
    select distinct on (coalesce(p.original_drive,''),coalesce(p.original_item,p.id::text)) p.id,p.alt,p.credit,o.title,o.location,o.starts,p.position
    from outing_photos p join outings o on o.id=p.outing_id
    where p.position is not null and (${canOperate(user)} or o.unit=any(${scopes}::text[]))
      ${excludeOuting ? sql`and o.id <> ${excludeOuting}` : sql``}
    order by coalesce(p.original_drive,''),coalesce(p.original_item,p.id::text),o.starts desc,o.id,p.position
    ) gallery order by starts desc,id,position`;
}
