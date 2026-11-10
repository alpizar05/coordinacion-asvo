import { OutingLogistics } from '../../../outing-logistics';
import { outingLogisticsFields, outingLogisticsMessage } from '../../../../lib/outing-logistics';
import { AddRegistration } from '../../add-registration';
import { compactParticipationDates } from '../../../../lib/participation-dates';
import { ActionModal } from '../../action-modal';
import { OutingTabs } from './outing-tabs';
import { FoodSummary } from '../../food-summary';
import { TransportSummary } from '../../transport-summary';
import { StatusRibbon } from '../../../status-ribbon';
import { HomepageFeatureControl } from '../../homepage-feature-control';
import { InheritedField } from './inherited-field';
import { commonOutingFields } from '../../../../lib/collection-fields';
import { OutingInvitation } from './outing-invitation';
import { registrationToday } from '../../../../lib/outing-invitations';
import { OutingRegistrationFilter } from './registration-filter';
import { statusLabels } from '../../registration-statuses';
import { AttachPhotos } from './attach-photos';
import { outingPhotoGallery } from '../../../../lib/outing-photo-gallery';
import { outingPhotoLimit } from '../../../../lib/outing-photo-limits';
import CoordinationBreadcrumb from '../../breadcrumb';
import { RegistrationActions } from '../../registration-actions';
import { managePhoto } from '../../../photo-actions';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canOperate, staff } from '../../../../lib/auth';
import { appUrl, demo, sql } from '../../../../lib/db';
import { displayDate, outingIsEditable, suggestedGroups, uuid } from '../../../../lib/registration';
import { manageOuting, splitOutingGroup } from '../../../staff-actions';
import { CopyMessage } from './message';

const receivedFormat = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica', dateStyle: 'short', timeStyle: 'short',
});

export default async function Page({params,searchParams}: {params:Promise<{id:string}>;searchParams:Promise<{error?:string;inscripcion?:string;gestion?:string;editar?:string;estado?:string;unidadPropuesta?:string;grupoCreado?:string;errorGrupo?:string;destacadaError?:string;gestionada?:string;completada?:string;pestana?:string}>}) {
  const {id} = await params;
  const user = await staff();
  if (!uuid(id)) notFound();
  const [outing] = await sql`select *,starts::text as first_day,ends::text as last_day,
    ends < ${registrationToday} as has_ended,
    coalesce(registration_deadline,starts)::text as deadline,
    coalesce(registration_deadline,starts) >= ${registrationToday} as accepting
    from outings where id=${id}`;
  if (!outing || !canOperate(user,outing.unit)) notFound();
  const canViewProfile = canOperate(user);
  const photos = await sql`select id,alt,credit from outing_photos
    where outing_id=${id} and position is not null order by position`;
  const entries = await sql`select r.id,r.identification,r.status,r.received_at,r.starts::text,r.ends::text,r.details,
    (r.status='confirmada' and r.details->'assigned70'='true'::jsonb) as assigned70,
    exists(select 1 from outing_reports p where p.lead_registration_id=r.id and p.outing_id=r.outing_id and p.status='finalizado') as report_finalized,
    exists(select 1 from outing_brief_links l where l.lead_registration_id=r.id and l.outing_id=r.outing_id and l.revoked_at is null and l.expires_at>clock_timestamp()) as report_link,
    exists(select 1 from report_reminders q join registration_mail_outbox m on m.id=q.mail_id where q.registration_id=r.id and m.sent_at is null and m.cancelled_at is null) as reminder_pending,
    v.email as volunteer_email,v.id as volunteer_id,concat_ws(' ',v.name,v.surname,v.second_surname) as volunteer,exists(select 1 from policies p where p.volunteer_id=v.id and p.verified_at is not null
      and p.starts<=r.starts and p.ends>=r.ends) as covered,
    (${outing.unit}='Voluntariado General' or ${outing.unit}=any(v.units)) as eligible
    from registrations r left join volunteers v on v.id=r.volunteer_id where r.outing_id=${id} order by r.received_at,r.id`;
  const { error, inscripcion, gestion, editar, estado, unidadPropuesta, grupoCreado, errorGrupo, destacadaError, gestionada, completada, pestana } = await searchParams;
  const registrationStatus = estado && statusLabels.has(estado) ? estado : 'todos';
  const visibleEntries = registrationStatus === 'todos' ? entries : entries.filter(entry => entry.status === registrationStatus);
  const editable = outingIsEditable(outing.status);
  const editing = editable && editar === '1';
  const back = `/coordinacion/salidas/${id}`;
  const canAttachPhotos = editing && photos.length < outingPhotoLimit;
  const gallery = canAttachPhotos ? await outingPhotoGallery(user, id) : [];
  const [request] = await sql`select organization,contact,area,activity,plan,outing_defaults,outing_photos_initialized from requests where id=${outing.request_id}`;
  const scopes = user?.grants.filter(grant => grant.role === 'unidad').map(grant => grant.unit) ?? [];
  const units = editing ? await sql`select name from units where ${canViewProfile} or name=any(${scopes}::text[]) order by name` : [];
  const related = editing ? await sql`select id,title,unit,starts::text,ends::text from outings
    where request_id=${outing.request_id} order by starts,id` : [];
  const canEditRequest = editing && related.every(block => canOperate(user, block.unit));
  const conflicts = editing && unidadPropuesta && units.some(unit => unit.name === unidadPropuesta)
    && unidadPropuesta !== 'Voluntariado General' && unidadPropuesta !== outing.unit
    ? await sql`select r.id,concat_ws(' ',v.name,v.surname,v.second_surname) as name,r.starts::text,r.ends::text
      from registrations r left join volunteers v on v.id=r.volunteer_id
      where r.outing_id=${id} and r.status in ('validación','revisión','espera','confirmada')
        and (v.id is null or not (${unidadPropuesta}=any(v.units)))
      order by r.received_at,r.id` : [];
  const defaults = request.outing_defaults ?? outing;
  const inheritedField = (item: typeof commonOutingFields[number]) => <InheritedField key={item.name}
    name={item.name} label={item.label} general={defaults[item.name] ?? ''} current={outing[item.name] ?? ''}
    overridden={outing.outing_overrides.includes(item.name)} multiline={item.multiline}
    options={item.name === 'unit' ? units.map(unit => unit.name) : undefined} />;
  const requestFields = [
    ['organization','Organización solicitante'], ['contact','Contacto solicitante'],
    ['area','Área silvestre protegida'], ['activity','Tipo de actividad'], ['plan','Plan de trabajo'],
  ];
  const occupied = entries.filter(entry => ['revisión','confirmada'].includes(entry.status)).length;
  const waiting = entries.filter(entry => ['revisión','espera'].includes(entry.status));
  const next = waiting.find(entry => entry.status === 'espera' && entry.eligible);
  const groups = !editing && outing.flexible ? suggestedGroups(entries.filter(row => ['revisión','espera','confirmada'].includes(row.status)).map(row => ({id:String(row.id),status:String(row.status),starts:String(row.starts),ends:String(row.ends),name:String(row.volunteer || "Ficha pendiente de conciliar")}))) : [];
  const message = [outing.title,outing.location,`${displayDate(outing.first_day)} al ${displayDate(outing.last_day)}`,outing.requirements,outingLogisticsMessage(outing),outing.logistics,`${appUrl()}/convocatorias/${id}`].filter(Boolean).join('\n');
  const decisions = !editing && outing.flexible ? await sql`select id,reason,happened_at from audit
    where target=${id} and action='Decidió agrupación' order by id desc` : [];
  const registrations = <>
  {!editing && <section className="card outing-registrations" aria-labelledby="inscripciones">
    <div className="outings-table-heading">
      <h2 id="inscripciones">Inscripciones</h2>
      <div className="actions">{['abierta','confirmada'].includes(outing.status) && <AddRegistration outing={{ id, starts: outing.first_day, ends: outing.last_day, flexible: outing.flexible, general: outing.unit === 'Voluntariado General' }} />}<OutingRegistrationFilter value={registrationStatus} /></div>
    </div>
    <p className="registration-count" role="status">{visibleEntries.length === entries.length
      ? `${entries.length} ${entries.length === 1 ? 'inscripción' : 'inscripciones'}`
      : `${visibleEntries.length} de ${entries.length} inscripciones`}</p>
    <div className="outings-scroll" tabIndex={0} role="region" aria-label="Inscripciones de la salida">
      <table className="outings-table outing-registration-table" role="table">
        <thead><tr>
          <th scope="col">Persona voluntaria</th>
          <th scope="col">Estado</th>
          <th scope="col">Fechas solicitadas</th>
          <th scope="col">Póliza</th>
          <th scope="col">Recepción</th>
          <th scope="col">Acciones</th>
        </tr></thead>
        <tbody>
          {visibleEntries.map(entry => <tr id={`inscripcion-${entry.id}`} key={entry.id}>
            <th scope="row" className="registration-person">{canViewProfile && entry.volunteer_id
              ? <Link href={`/coordinacion/registro/${entry.volunteer_id}`}>{entry.volunteer}</Link>
              : entry.volunteer || 'Ficha pendiente de conciliar'}
              {entry.assigned70 && <> <span className="pill coord-role-label">70</span></>}</th>
            <td className="registration-state"><span className="pill registration-state-desktop" data-status={entry.status}>{statusLabels.get(entry.status) ?? entry.status}</span>
              <span className="registration-state-mobile"><span className="pill" data-status={entry.status}>{entry.status.startsWith('cancelada') ? 'Cancelada' : statusLabels.get(entry.status) ?? entry.status}</span>
                {entry.status.startsWith('cancelada') && <span className="registration-cancelled-by">{entry.status === 'cancelada por coordinación' ? 'Por Coordinación' : 'Por voluntariado'}</span>}</span></td>
            <td className="table-date registration-dates"><span className="registration-date-desktop">{displayDate(entry.starts)} al {displayDate(entry.ends)}</span>
              <span className="registration-date-mobile">{compactParticipationDates(entry.starts,entry.ends)}</span></td>
            <td className="registration-policy">{entry.covered ? 'Comprobada' : 'Pendiente'}</td>
            <td className="table-date registration-received">{receivedFormat.format(entry.received_at)}</td>
            <td className="registration-actions">
              <RegistrationActions canManage={editable} personName={entry.volunteer}
                reportFollowup={outing.has_ended && ['abierta','confirmada','completada'].includes(outing.status) && entry.assigned70 ? {
                  outingId: id,title: outing.title,starts: displayDate(outing.first_day),ends: displayDate(outing.last_day),
                  email: entry.volunteer_email,activeLink: !!entry.report_link,pending: !!entry.reminder_pending,finalized: !!entry.report_finalized,demo,
                } : undefined}
                entry={{ id: entry.id, status: entry.status, identification: entry.identification, starts: entry.starts, ends: entry.ends, assigned70: !!entry.assigned70 }}
                outing={{ flexible: outing.flexible, first_day: outing.first_day, last_day: outing.last_day }}
                error={entry.id === inscripcion ? error : undefined}
                />
            </td>
          </tr>)}
          {!visibleEntries.length && <tr className="registration-empty"><td colSpan={6}>
            {entries.length ? 'No hay inscripciones con este estado.' : 'Todavía no hay inscripciones para esta salida.'}
          </td></tr>}
        </tbody>
      </table>
    </div>
  </section>}
  </>;
  const logisticsPanel = <>
  {!editing && <section className="card"><h2>Condiciones de la salida</h2><OutingLogistics outing={outing} />{outing.logistics && <p className="copy">{outing.logistics}</p>}</section>}
  {!editing && <section className="card" aria-labelledby="logistica-participacion">
    <h2 id="logistica-participacion">Logística de participación</h2>
    <TransportSummary entries={entries.map(entry => ({ id: entry.id, status: entry.status, volunteer: entry.volunteer,
      volunteer_id: entry.volunteer_id, details: entry.details }))} canViewProfile={canViewProfile} />
    <FoodSummary entries={entries.map(entry => ({ id: entry.id, status: entry.status, volunteer: entry.volunteer,
      volunteer_id: entry.volunteer_id, details: entry.details }))} canViewProfile={canViewProfile} />
  </section>}
  </>;
  const editData = <>
  {editing && <section className="card" id="datos-salida">
    <h2>Datos de la salida</h2>
    {conflicts.length > 0 && <div className="note" role="alert">
      <p>Revisá estas inscripciones antes de cambiar la unidad a {unidadPropuesta}.</p>
      <ul>{conflicts.map(entry => <li key={entry.id}>
        <a href={`${back}#inscripcion-${entry.id}`}>{entry.name || 'Ficha pendiente de conciliar'}</a>
        {' · '}{displayDate(entry.starts)} al {displayDate(entry.ends)}
      </li>)}</ul>
    </div>}
    <form action={manageOuting.bind(null,id)}>
      <div className="grid">
        {commonOutingFields.slice(0, 3).map(inheritedField)}
      </div>
      <p>Sin marcar Personalizar, se usa el dato general. Transporte, alimentación y hospedaje son específicos de este bloque. Unidad general: {defaults.unit}.</p>
      <button className="coord-button-primary" name="action" value="datos">Guardar datos de la salida</button>
    </form>
  </section>}
  </>;
  const information = <>
  <section className="card" id="informacion-salida">
    <h2>Información para voluntariado</h2>
    {editing ? <form action={manageOuting.bind(null,id)}>
      <div className="grid">
        {commonOutingFields.slice(3).map(inheritedField)}
        {outingLogisticsFields.map(item => <label key={item.name}>{item.label} del bloque<textarea name={item.name} defaultValue={outing[item.name] ?? ''} placeholder={item.placeholder} maxLength={5000} /></label>)}
      </div>
      <p>Sin marcar Personalizar, se usa el dato general. Transporte, alimentación y hospedaje son específicos de este bloque.</p>
      <button className="coord-button-primary" name="action" value="informacion">Guardar requisitos y logística</button>
    </form> : <div className="grid">
      <div><h3>Requisitos</h3><p className="copy">{outing.requirements || 'Sin requisitos registrados.'}</p></div>
      <div><h3>Condiciones del bloque</h3><OutingLogistics outing={outing} /><h3>Otras indicaciones logísticas</h3><p className="copy">{outing.logistics || 'Sin otras indicaciones registradas.'}</p></div>
    </div>}
  </section>
  <section className="card" id="solicitud-apoyo">
    <h2>Solicitud de apoyo</h2>
    {editing && !canEditRequest && <p>Para editar la solicitud compartida se requiere acceso a todos sus bloques.</p>}
    {canEditRequest ? <form action={manageOuting.bind(null,id)}>
      <div className="grid">{requestFields.map(([field, label]) => <label key={field}>{label}
        {field === 'plan' ? <textarea name={field} defaultValue={request[field] ?? ''} />
          : <input name={field} defaultValue={request[field] ?? ''} />}
      </label>)}</div>
      {related.length > 1 && <>
        <p>Los cambios se aplicarán a estos bloques:</p>
        <ul>{related.map(block => <li key={block.id}>
          {block.title} · {displayDate(block.starts)} al {displayDate(block.ends)}
        </li>)}</ul>
        <label><input name="confirmShared" type="checkbox" required /> Confirmo el cambio para todos estos bloques.</label>
      </>}
      <button className="coord-button-primary" name="action" value="solicitud">Guardar solicitud de apoyo</button>
    </form> : <dl className="profile-facts">
      {requestFields.map(([field, label]) => <div key={field}><dt>{label}</dt><dd className="copy">{request[field] || 'Pendiente'}</dd></div>)}
    </dl>}
  </section>
  {editing && <section className="card" id="fechas">
    <h2>Fechas y modalidad</h2>
    <form action={manageOuting.bind(null,id)}>
      <div className="grid">
        <label>Inicio<input name="starts" type="date" defaultValue={outing.first_day} required /></label>
        <label>Fin<input name="ends" type="date" defaultValue={outing.last_day} required /></label>
        <label>Modalidad<select name="mode" defaultValue={outing.flexible ? 'flexible' : 'fija'}>
          <option value="fija">Fechas fijas</option>
          <option value="flexible">Fechas flexibles</option>
        </select></label>
      </div>
      <label>Motivo del cambio<input name="reason" required /></label>
      <button className="coord-button-primary" name="action" value="fechas">Guardar fechas y modalidad</button>
    </form>
  </section>}
  {editing && <section className="card" id="visibilidad">
    <h2>Visibilidad</h2>
    <form action={manageOuting.bind(null,id)}>
      <label>Acceso a la convocatoria<select name="visibility" defaultValue={outing.listed ? 'publica' : 'privada'}>
        <option value="publica">Pública · visible en el catálogo</option>
        <option value="privada">Privada · solo por enlace directo</option>
      </select></label>
      <label>Fecha límite de inscripción
        <input type="date" name="registrationDeadline" defaultValue={outing.deadline} max={outing.first_day} required />
      </label>
      <p>Al terminar ese día, hora de Costa Rica, solo podrán inscribirse las personas invitadas.</p>
      <button className="coord-button-primary" name="action" value="visibilidad">Guardar visibilidad y fecha límite</button>
    </form>
  </section>}
  <section className="card" id="fotos">
    <h2>Fotos de la convocatoria</h2>
    <p>{photos.length} de {outingPhotoLimit}. La primera foto es la portada del catálogo.</p>
    {photos.length > 0 && <ol className="photo-admin-list">{photos.map((photo,index) => <li key={photo.id}>
      <img src={`/api/fotos/${photo.id}?v=tarjeta`} alt={photo.alt} loading="lazy" />
      <div>
        <strong>{index === 0 ? 'Portada · ' : ''}{photo.alt}</strong>
        {photo.credit && <p>{photo.credit}</p>}
        {editing && <AttachPhotos id={id} gallery={[]} initial={{ id: photo.id, alt: photo.alt, credit: photo.credit }} />}
        {editing && <form action={managePhoto.bind(null,id)} className="actions">
          <input type="hidden" name="photoId" value={photo.id} />
          {index > 0 && <><button name="action" value="portada">Hacer portada</button><button name="action" value="subir">Subir una posición</button></>}
          {index < photos.length-1 && <button name="action" value="bajar">Bajar una posición</button>}
          {(outing.status !== 'abierta' || photos.length > 1) && <button name="action" value="retirar">Retirar foto</button>}
        </form>}
      </div>
    </li>)}</ol>}
    {editing && <p>{outing.outing_overrides.includes('photos')
      ? 'Este bloque tiene fotos propias.'
      : 'Este bloque hereda las fotos generales. Agregar, retirar o reordenar una foto personaliza su galería.'}</p>}
    {editing && request.outing_photos_initialized && outing.outing_overrides.includes('photos') &&
      <form action={manageOuting.bind(null,id)}>
        <button name="action" value="heredar-fotos">Volver a usar las fotos generales</button>
      </form>}
    {canAttachPhotos && <AttachPhotos id={id} gallery={gallery} />}
  </section>
  </>;
  const tools = <>
  {!editing && <section className="card"><h2>Resumen para el 70</h2>
    <p>Consultá las personas confirmadas, sus fechas, contactos y logística. Generá un enlace privado para la persona asignada como 70.</p>
    <Link className="button" href={`${back}/resumen`}>Ver resumen e informes de la salida</Link>
  </section>}
  {!editing && !outing.flexible && !['abierta','confirmada'].includes(outing.status) && <section className="card"><h2>Herramientas de coordinación</h2><p>No hay herramientas disponibles para esta salida en su estado actual.</p></section>}
  {(editing || (outing.capacity > occupied && next)) && <section className="card" id="cupos"><h2>Gestión de cupos</h2>
    {!editing && outing.capacity > occupied && next && <p className="note">Siguiente solicitud elegible: {next.volunteer} · {next.covered ? 'Póliza comprobada' : 'Póliza pendiente'}</p>}
    {editing && <form action={manageOuting.bind(null,id)}><div className="grid"><label>Cupo total<input name="capacity" type="number" min="1" max="10000" defaultValue={outing.capacity}/></label><label>Motivo del ajuste<input name="reason" required /></label></div>
      <div className="actions"><button className="coord-button-primary" name="action" value="cupo">Cambiar cupo</button>{outing.status === 'borrador' && <button className="coord-button-primary" name="action" value="publicar" formNoValidate>Publicar convocatoria</button>}</div>
    </form>}
  </section>}
  {!editing && outing.status === 'abierta' && outing.accepting && <section className="card"><h2>Comunicado para WhatsApp</h2><CopyMessage initial={message}/><Link href={`/convocatorias/${id}`}>Ver convocatoria pública</Link></section>}
  {!editing && ['abierta','confirmada'].includes(outing.status) && <section className="card">
    <h2>Invitación directa</h2>
    <OutingInvitation id={id} />
  </section>}
  {!editing && outing.flexible && <section className="card" id="agrupaciones"><h2>Agrupaciones sugeridas</h2>
    <p>Los días de llegada y regreso cuentan como días de participación. Capacidad total de la salida: {outing.capacity}. {entries.some(entry => entry.assigned70) ? 'Personas asignadas como 70: ' + entries.filter(entry => entry.assigned70).map(entry => entry.volunteer).join(', ') + '.' : 'Cobertura de 70 pendiente de asignar.'}</p>
    {errorGrupo && <p className="note" role="alert">{errorGrupo}</p>}
    {grupoCreado && uuid(grupoCreado) && <>
      <StatusRibbon key={grupoCreado} message="Grupo trasladado a la nueva salida." />
      <p><Link href={`/coordinacion/salidas/${grupoCreado}`}>Abrir la nueva salida</Link></p>
    </>}
    {!groups.length && <p>No hay inscripciones para agrupar.</p>}
    {groups.map(group => {
      const groupOccupied = group.people.filter(person => ['revisión','confirmada'].includes(person.status)).length;
      return <div className="card" key={group.starts}>
        <h3>{displayDate(group.starts)} al {displayDate(group.ends)}</h3>
        <p>{group.people.length} personas · {groupOccupied} con cupo</p>
        <ul>{group.people.map(person => <li key={person.id}>
          <a href={`${back}#inscripcion-${person.id}`}>{person.name}</a> · {displayDate(person.starts)} al {displayDate(person.ends)}
          {' · '}{statusLabels.get(person.status) ?? person.status}
        </li>)}</ul>
        {['abierta', 'confirmada'].includes(outing.status) && <ActionModal title="Crear salida para este grupo" saveLabel="Crear salida y trasladar grupo" action={splitOutingGroup.bind(null,id,group.starts,group.ends)}>
            {group.people.map(person => <input key={person.id} type="hidden" name="member" value={person.id} />)}
            <div className="grid">
              <label>Título de la nueva salida<input name="title" required maxLength={200}
                defaultValue={`${outing.title} · ${displayDate(group.starts)}`.slice(0, 200)} /></label>
              <label>Cupos<input name="capacity" type="number" required min={Math.max(1,groupOccupied)} max="10000"
                defaultValue={Math.min(10000,group.people.length)} /></label>
            </div>
            <p>Se crea una salida privada y flexible para estas fechas. Se trasladan las inscripciones de este grupo con sus estados y fechas. Las demás quedan en la salida original.</p>
        </ActionModal>}
      </div>;
    })}
    {decisions.map(decision => <p className="copy" key={decision.id}>{decision.reason}</p>)}
    {editable && <form action={manageOuting.bind(null,id)}>
      <label>Decisión de coordinación<textarea name="reason" required /></label>
      <button className="coord-button-primary" name="action" value="agrupación">Registrar decisión</button>
    </form>}
  </section>}
  </>;
  const editEnd = <>
  {editing && ['abierta', 'confirmada'].includes(outing.status) && <section className="card" id="completar-salida">
    <h2>Completar salida</h2>
    {outing.has_ended ? <form action={manageOuting.bind(null,id)}>
      <p>Al completar este bloque, su ficha queda en solo lectura y las inscripciones se conservan en el historial.</p>
      <label><input type="checkbox" name="confirmCompleted" required /> Confirmo que la actividad se realizó.</label>
      <button type="submit" name="action" value="completar">Marcar como completada</button>
    </form> : <p>Podés completar esta salida a partir del día siguiente al regreso.</p>}
  </section>}
  {editing && <section className="card outing-danger-zone" id="gestionar-salida" aria-labelledby="gestionar-salida-titulo">
    {error && gestion && <p className="note" role="alert">{error}</p>}
    <p className="eyebrow">Acción definitiva</p>
    <h2 id="gestionar-salida-titulo">{entries.length ? 'Cancelar convocatoria' : 'Eliminar convocatoria'}</h2>
    <form action={manageOuting.bind(null,id)}>
      {entries.length ? <>
        <p>Se cerrará la convocatoria y se cancelarán las inscripciones activas. Las solicitudes quedarán en el historial.</p>
        <label>Motivo de la cancelación<input name="reason" required /></label>
        <button className="coord-button-danger" name="action" value="cancelar-salida">Cancelar convocatoria</button>
      </> : <>
        <p>Esta convocatoria puede eliminarse porque no tiene inscripciones.</p>
        <label><input type="checkbox" name="confirmDelete" required /> Confirmo que quiero eliminar esta convocatoria.</label>
        <button className="coord-button-danger" name="action" value="eliminar">Eliminar convocatoria</button>
      </>}
    </form>
  </section>}
  </>;
  return <><CoordinationBreadcrumb current={outing.title} parent={{ href: "/coordinacion/convocatorias#salidas", label: "Convocatorias de salida" }} />
  <header className={`card coordination-outing-summary${editing ? '' : ' outing-tabbed-summary'}`}>
    <div className="outings-table-heading">
      <div className="actions">
        <span className="pill" data-status={outing.status}>Estado · {outing.status}</span>
        {editing ? <span>Inscripciones: <strong>{occupied}/{outing.capacity}</strong></span>
          : <a href="#inscripciones">Inscripciones: <strong>{occupied}/{outing.capacity}</strong></a>}
      </div>
      {editable && !editing && <Link className="button" href={`${back}?editar=1`}>Editar salida</Link>}
    </div>
    <h1>{outing.title}</h1>
    <dl className="profile-facts">
      <div><dt>Lugar</dt><dd>{outing.location}</dd></div>
      <div><dt>Unidad</dt><dd>{outing.unit}</dd></div>
      <div><dt>Fechas</dt><dd>{displayDate(outing.first_day)} al {displayDate(outing.last_day)}</dd></div>
      <div><dt>Modalidad</dt><dd>{outing.flexible ? 'Fechas flexibles' : 'Fechas fijas'}</dd></div>
      <div><dt>Visibilidad</dt><dd>{!outing.accepting ? 'Solo con invitación' : outing.listed ? 'Pública' : 'Privada por enlace'}</dd></div>
      <div><dt>Fecha límite de inscripción</dt><dd>{displayDate(outing.deadline)}</dd></div>
    </dl>
    {!editing && <HomepageFeatureControl kind="outing" id={id}
      available={outing.status === 'abierta' && outing.listed && outing.accepting} error={destacadaError} />}
  </header>
    {editing && <div className="outing-edit-banner" id="modo-edicion">
      <div>
        <strong>Modo edición</strong>
        <p>Guardá los cambios en cada sección.</p>
      </div>
      <Link className="button" href={back}>Salir del modo edición</Link>
    </div>}
  {gestionada && uuid(gestionada) && <StatusRibbon key={gestionada} message="Inscripción actualizada." />}
  {completada === '1' && outing.status === 'completada' && <StatusRibbon message="Salida completada." />}
  {!editable && <p className="note">Convocatoria de solo lectura.</p>}
  {error && (!editable || (!gestion && !entries.some(entry => entry.id === inscripcion))) && <p className="note" role="alert">{error}</p>}
  {editing ? <>{editData}{information}{tools}{editEnd}</> : <OutingTabs
    initial={errorGrupo || grupoCreado ? 'herramientas' : pestana === 'logistica' || pestana === 'informacion' || pestana === 'herramientas' ? pestana : 'inscripciones'}
    panels={{ inscripciones: registrations, logistica: logisticsPanel, informacion: information, herramientas: tools }} />}
  </>;
}
