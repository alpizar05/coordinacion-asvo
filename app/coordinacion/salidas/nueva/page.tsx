import CoordinationBreadcrumb from '../../breadcrumb';
import { notFound } from 'next/navigation';
import { staff } from '../../../../lib/auth';
import { outingPhotoGallery } from '../../../../lib/outing-photo-gallery';
import { uuid } from '../../../../lib/registration';
import { sql } from '../../../../lib/db';
import { NewOutingForm, type OutingTemplate } from './new-outing-form';

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; bloque?: string }> }) {
  const user = await staff();
  const general = !!user?.grants.some(grant => grant.role === 'general');
  const scopes = user?.grants.filter(grant => grant.role === 'unidad').map(grant => grant.unit) ?? [];
  if (!general && !scopes.length) notFound();
  const available = await sql`select name from units where ${general} or name=any(${scopes}::text[]) order by name`;
  const { error, bloque } = await searchParams;
  if (bloque && !uuid(bloque)) notFound();
  const templates = bloque ? await sql<OutingTemplate[]>`
    select o.id,o.request_id,o.title,o.location,o.unit,o.starts::text,o.ends::text,o.flexible,o.capacity,
      o.requirements,o.logistics,o.transport_details,o.food_details,o.lodging_details,o.listed,o.registration_deadline::text,r.organization,r.contact,r.area,r.activity,r.plan,
      coalesce((select json_agg(json_build_object('id',p.id,'alt',p.alt,'credit',p.credit) order by p.position)
        from outing_photos p where p.outing_id=o.id and p.position is not null),'[]'::json) as photos
    from outings o join requests r on r.id=o.request_id
    where o.id=${bloque} and (${general} or o.unit=any(${scopes}::text[]))`
    : await sql<OutingTemplate[]>`select distinct on (o.request_id)
    o.id,o.request_id,coalesce(r.outing_defaults->>'title',o.title) as title,
    coalesce(r.outing_defaults->>'location',o.location) as location,
    case when ${general} or (r.outing_defaults->>'unit')=any(${scopes}::text[])
      then coalesce(r.outing_defaults->>'unit',o.unit) else o.unit end as unit,
    o.starts::text,o.ends::text,o.flexible,o.capacity,
    coalesce(r.outing_defaults->>'requirements',o.requirements) as requirements,
    coalesce(r.outing_defaults->>'logistics',o.logistics) as logistics,o.transport_details,o.food_details,o.lodging_details,o.listed,o.registration_deadline::text,
    r.organization,r.contact,r.area,r.activity,r.plan,
    coalesce((select json_agg(json_build_object('id',p.id,'alt',p.alt,'credit',p.credit) order by p.position)
      from outing_photos p where p.outing_id=coalesce((
        select b.id from outings b where b.request_id=o.request_id and not ('photos'=any(b.outing_overrides))
          and (${general} or b.unit=any(${scopes}::text[]))
        order by b.starts,b.id limit 1
      ),o.id) and p.position is not null),'[]'::json) as photos
    from outings o join requests r on r.id=o.request_id
    where ${general} or o.unit=any(${scopes}::text[]) order by o.request_id,o.starts desc,o.id`;
  const gallery = await outingPhotoGallery(user);
  const clone = bloque ? templates[0] : undefined;
  if (bloque && !clone) notFound();
  const title = clone ? 'Nuevo bloque de convocatoria' : 'Nueva convocatoria de salida';
  const collection = clone ? `/coordinacion/colecciones/automaticas/${clone.request_id}#bloques` : undefined;

  return <>
    <CoordinationBreadcrumb current={title} parent={collection
      ? { href: collection, label: 'Convocatoria general' }
      : { href: '/coordinacion/convocatorias#salidas', label: 'Convocatorias de salida' }} />
    <h1>{title}</h1>
    <section className="card">
      {error && <p className="note" role="alert">{error}</p>}
      <NewOutingForm key={clone?.id ?? "new"} clone={clone} gallery={gallery} templates={templates} units={available.map(row => row.name)} />
    </section>
  </>;
}
