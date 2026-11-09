import { canOperate, type staff } from './auth';
import { sql } from './db';

export type GalleryPhoto = { id: string; alt: string; title: string; location: string };

export function outingPhotoGallery(user: Awaited<ReturnType<typeof staff>>, excludeOuting?: string) {
  const scopes = user?.grants.filter(grant => grant.role === 'unidad').map(grant => grant.unit) ?? [];
  return sql<GalleryPhoto[]>`
    select p.id,p.alt,o.title,o.location
    from outing_photos p join outings o on o.id=p.outing_id
    where p.position is not null and (${canOperate(user)} or o.unit=any(${scopes}::text[]))
      ${excludeOuting ? sql`and o.id <> ${excludeOuting}` : sql``}
    order by o.starts desc,o.id,p.position`;
}
