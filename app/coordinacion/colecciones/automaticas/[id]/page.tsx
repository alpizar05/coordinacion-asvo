import { CapacitySummary } from '../../../../capacity-summary';
import { StatusRibbon } from '../../../../status-ribbon';
import { HomepageFeatureControl } from '../../../homepage-feature-control';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { canOperate, staff } from '../../../../../lib/auth';
import { sql } from '../../../../../lib/db';
import { registrationToday } from '../../../../../lib/outing-invitations';
import { displayDate, outingIsEditable, uuid } from '../../../../../lib/registration';
import { commonOutingFields, supportRequestFields } from '../../../../../lib/collection-fields';
import { updateAutomaticCollection } from '../../../../staff-actions';
import CoordinationBreadcrumb from '../../../breadcrumb';

export default async function AutomaticCollection({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string; error?: string; guardado?: string; creados?: string; destacadaError?: string }>;
}) {
  const { id } = await params;
  if (!uuid(id)) notFound();
  const user = await staff();
  if (!user) redirect('/coordinacion');
  const general = canOperate(user);
  const scopes = user.grants.filter(grant => grant.role === 'unidad').map(grant => grant.unit);
  if (!general && !scopes.length) notFound();

  const blocks = await sql`
    select id,title,location,unit,starts::text,ends::text,status,listed,capacity,flexible,requirements,logistics,outing_overrides,
      (select count(*)::int from registrations r where r.outing_id=outings.id and r.status in ('revisión','confirmada')) as occupied,
      (status='abierta' and listed and coalesce(registration_deadline,starts) >= ${registrationToday}) as public
    from outings where request_id=${id} and (${general} or unit=any(${scopes}::text[]))
    order by starts,id`;
  if (!blocks.length) notFound();
  const [request] = await sql`select organization,contact,area,activity,plan,outing_defaults from requests where id=${id}`;
  if (!request) notFound();

  const defaults = request.outing_defaults ?? blocks[0];
  const title = defaults.title;
  const { editar, error, guardado, creados, destacadaError } = await searchParams;
  const path = `/coordinacion/colecciones/automaticas/${id}`;
  const [access] = await sql`select not exists (
    select 1 from outings where request_id=${id} and not (${general} or unit=any(${scopes}::text[]))
  ) as allowed`;
  const editing = access.allowed && editar === '1';
  const editableBlocks = blocks.filter(block => outingIsEditable(block.status));
  const units = editing ? await sql`select name from units where ${general} or name=any(${scopes}::text[]) order by name` : [];
  const photoSources = editing ? await sql`select o.id,o.title,o.starts::text
    from outings o join outing_photos p on p.outing_id=o.id and p.position=1
    where o.request_id=${id} order by o.starts,o.id` : [];
  const [photos] = await sql`select count(*)::int as total from request_outing_photos where request_id=${id}`;
  return <>
    <CoordinationBreadcrumb current={title} parent={{ href: '/coordinacion#colecciones', label: 'Convocatorias de salida' }} />
    <header className="card coordination-outing-summary">
      <div className="outings-table-heading">
        <span className="eyebrow">Convocatoria en serie · Automática</span>
        {access.allowed && !editing && <Link className="button" href={`${path}?editar=1`}>Editar datos comunes</Link>}
      </div>
      <h1>{title}</h1>
      <p>{blocks.length} {blocks.length === 1 ? 'bloque asociado' : 'bloques asociados'}</p>
      {!editing && blocks.some(block => block.public) && <Link href={`/colecciones/${id}`}>Ver serie pública</Link>}
      {!editing && access.allowed && <HomepageFeatureControl kind="request" id={id}
        available={blocks.some(block => block.public)} error={destacadaError} />}
    </header>
    {guardado === '1' && <StatusRibbon message="Datos comunes actualizados." />}
    {editing && <div className="outing-edit-banner">
      <div><strong>Modo edición</strong><p>Elegí los campos que querés aplicar a los bloques.</p></div>
      <Link className="button" href={path}>Salir del modo edición</Link>
    </div>}
    {editing ? <form className="card" id="datos-comunes" action={updateAutomaticCollection.bind(null, id)}>
      {error && <p className="note" role="alert">{error}</p>}
      {blocks.map(block => <input key={block.id} type="hidden" name="block" value={block.id} />)}
      {editableBlocks.map(block => <input key={block.id} type="hidden" name="editableBlock" value={block.id} />)}
      <fieldset disabled={!editableBlocks.length}>
        <legend>Datos de la salida</legend>
        <div className="grid">{commonOutingFields.slice(0, 3).map(item => <div key={item.name}>
          <label><input type="checkbox" name="apply" value={item.name} /> Actualizar {item.label.toLowerCase()}</label>
          <label>{item.label}{item.name === 'unit'
            ? <select name="unit" defaultValue={defaults.unit}>{units.map(unit => <option key={unit.name}>{unit.name}</option>)}</select>
            : <input name={item.name} defaultValue={defaults[item.name] ?? ''} />}
          </label>
        </div>)}</div>
      </fieldset>
      <fieldset disabled={!editableBlocks.length}>
        <legend>Información para voluntariado</legend>
        <div className="grid">{commonOutingFields.slice(3).map(item => <div key={item.name}>
          <label><input type="checkbox" name="apply" value={item.name} /> Actualizar {item.label.toLowerCase()}</label>
          <label>{item.label}<textarea name={item.name} defaultValue={defaults[item.name] ?? ''} /></label>
        </div>)}</div>
      </fieldset>
      <fieldset disabled={!photoSources.length}>
        <legend>Fotos generales</legend>
        <p>{photos.total} fotos generales. Podés usar la galería de un bloque como referencia para los que heredan las fotos.</p>
        <label><input type="checkbox" name="apply" value="photos" /> Actualizar fotos generales</label>
        <label>Copiar fotos desde un bloque
          <select name="photoSource" defaultValue="">
            <option value="">Elegí un bloque</option>
            {photoSources.map(block => <option key={block.id} value={block.id}>
              {block.title} · {displayDate(block.starts)}
            </option>)}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>Solicitud de apoyo</legend>
        <label><input type="checkbox" name="apply" value="support" /> Actualizar la solicitud compartida por todos los bloques</label>
        <div className="grid">{supportRequestFields.map(item => <label key={item.name}>{item.label}
          {item.multiline ? <textarea name={item.name} defaultValue={request[item.name] ?? ''} />
            : <input name={item.name} defaultValue={request[item.name] ?? ''} />}
        </label>)}</div>
      </fieldset>
      <fieldset>
        <legend>Revisá el alcance de los cambios</legend>
        <ul>{blocks.map(block => <li key={block.id}>
          {block.title} · {displayDate(block.starts)} al {displayDate(block.ends)}
          {' · '}{outingIsEditable(block.status) ? 'Hereda los datos generales salvo las excepciones del bloque' : 'Solo solicitud de apoyo'}
        </li>)}</ul>
        <label><input type="checkbox" name="confirm" required /> Confirmo los cambios para los bloques indicados.</label>
      </fieldset>
      <button className="coord-button-primary" type="submit">Guardar datos comunes</button>
    </form> : <>
      <section className="card">
        <h2>Datos de la salida</h2>
        <dl className="profile-facts">{commonOutingFields.slice(0, 3).map(item =>
          <div key={item.name}><dt>{item.label}</dt><dd>{defaults[item.name] || 'Pendiente'}</dd></div>
        )}</dl>
      </section>
      <section className="card">
        <h2>Información para voluntariado</h2>
        <dl className="profile-facts">{commonOutingFields.slice(3).map(item =>
          <div key={item.name}><dt>{item.label}</dt><dd className="copy">{defaults[item.name] || 'Pendiente'}</dd></div>
        )}</dl>
        <p>Fotos generales: {photos.total}</p>
      </section>
      <section className="card">
        <h2>Solicitud de apoyo</h2>
        <dl className="profile-facts">{supportRequestFields.map(item =>
          <div key={item.name}><dt>{item.label}</dt><dd className="copy">{request[item.name] || 'Pendiente'}</dd></div>
        )}</dl>
      </section>
    </>}
    <section className="card" id="bloques">
      <h2>Bloques de convocatoria</h2>
      {!editing && <p>Elegí <strong>Clonar bloque</strong> en la fila que querés usar como punto de partida.</p>}
      {creados && /^[1-9]\d?$/.test(creados) && <StatusRibbon message={creados === '1' ? 'Se agregó un bloque.' : `Se agregaron ${creados} bloques.`} />}
      <div className="outings-scroll" tabIndex={0} role="region" aria-label="Bloques de convocatoria asociados">
        <table className="outings-table">
          <thead><tr>
            <th scope="col">Convocatoria</th><th scope="col">Unidad</th><th scope="col">Fechas</th>
            <th scope="col">Excepciones</th><th scope="col">Modalidad</th><th scope="col">Cupos</th><th scope="col">Estado</th><th scope="col">Visibilidad</th>{!editing && <th scope="col">Acciones</th>}
          </tr></thead>
          <tbody>{blocks.map(block => <tr key={block.id}>
            <th scope="row"><Link href={`/coordinacion/salidas/${block.id}`}>{block.title}</Link><br />{block.location}</th>
            <td>{block.unit}</td>
            <td className="table-date">{displayDate(block.starts)} al {displayDate(block.ends)}</td>
            <td>{[
              ...commonOutingFields.filter(item => block.outing_overrides.includes(item.name)).map(item => item.label),
              ...(block.outing_overrides.includes('photos') ? ['Fotos'] : []),
            ].join(', ') || 'Hereda los datos generales'}</td>
            <td>{block.flexible ? 'Flexible' : 'Fija'}</td>
            <td><CapacitySummary capacity={block.capacity} occupied={block.occupied} detail /></td>
            <td>{block.status}</td>
            <td>{block.public ? 'En catálogo' : 'Fuera del catálogo'}</td>
            {!editing && <td><Link href={`/coordinacion/salidas/nueva?bloque=${block.id}`}
              aria-label={`Clonar bloque de ${block.title} del ${displayDate(block.starts)}`}>Clonar bloque</Link></td>}
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </>;
}
