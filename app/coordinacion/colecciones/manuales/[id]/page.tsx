import {collectionAccessCondition} from '../../../../../lib/authorization-sql';
import { NavigationResults } from '../../../navigation-context';
import { randomUUID } from 'node:crypto';
import { ContextDetailLink, ContextReturnLink } from '../../../navigation-context';
import { compactParticipationDates } from '../../../../../lib/participation-dates';
import { CapacitySummary } from '../../../../capacity-summary';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { canOperate, staff, staffScope } from '../../../../../lib/auth';
import { sql } from '../../../../../lib/db';
import { registrationToday } from '../../../../../lib/outing-invitations';
import { displayDate, uuid } from '../../../../../lib/registration';
import CoordinationBreadcrumb from '../../../breadcrumb';

export default async function ManualCollectionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid(id)) notFound();
  const user = await staff();
  if (!user) redirect('/coordinacion');
  const general = canOperate(user);
  const scopes = staffScope(user).units;
  if (!general && !scopes.length) notFound();
  const [collection] = await sql`select name,description from outing_collections
    where id=${id} and ${collectionAccessCondition(sql,user)}`;
  if (!collection) notFound();
  const blocks = await sql`select o.id,o.title,o.unit,o.starts::text,o.ends::text,o.status,o.capacity,
      (select count(*)::int from registrations where outing_id=o.id and status in ('revisión','confirmada')) as occupied,
      (o.status='abierta' and o.listed and coalesce(o.registration_deadline,o.starts) >= ${registrationToday}) as public
    from outing_collection_members m join outings o on o.id=m.outing_id
    where m.collection_id=${id} and (${general} or o.unit=any(${scopes}::text[]))
    order by o.starts,o.id`;

  return <><NavigationResults revision={randomUUID()}/>
    <ContextReturnLink />
    <CoordinationBreadcrumb current={collection.name} parent={{ href: '/coordinacion/convocatorias#colecciones', label: 'Convocatorias de salida' }} />
    <header className="card coordination-outing-summary">
      <span className="eyebrow">Convocatoria en serie · Manual</span>
      <h1>{collection.name}</h1>
      {collection.description && <p className="copy">{collection.description}</p>}
      {blocks.some(block => block.public) && <Link href={`/colecciones/manuales/${id}`}>Ver serie pública</Link>}
    </header>
    <section className="card">
      <h2>Salidas asociadas</h2>
      {blocks.length ? <div className="outings-scroll" tabIndex={0} role="region" aria-label="Salidas asociadas">
        <table className="outings-table coordination-compact-table compact-blocks" data-navigation-list="series-blocks">
          <thead><tr><th scope="col">Salida</th><th scope="col">Unidad</th><th scope="col">Fechas</th><th scope="col">Cupos</th><th scope="col">Estado</th><th scope="col">Disponibilidad</th></tr></thead>
          <tbody>{blocks.map(block => <tr id={`bloque-${block.id}`} key={block.id}>
            <th scope="row"><ContextDetailLink anchor={`bloque-${block.id}`} href={`/coordinacion/salidas/${block.id}`}>{block.title}</ContextDetailLink></th>
            <td data-label="Unidad">{block.unit}</td>
            <td data-label="Fechas" className="table-date"><span className="compact-desktop-only">{displayDate(block.starts)} al {displayDate(block.ends)}</span><span className="compact-mobile-only">{compactParticipationDates(block.starts,block.ends)}</span></td>
            <td data-label="Cupos"><CapacitySummary capacity={block.capacity} occupied={block.occupied} detail /></td>
            <td data-label="Estado">{block.status}</td>
            <td data-label="Disponibilidad">{block.public ? 'En catálogo' : 'Fuera del catálogo'}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p>No hay salidas asociadas disponibles para tu rol.</p>}
    </section>
  </>;
}
