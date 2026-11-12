import { ContextReturnLink } from '../../navigation-context';
import { RegistryModal,RegistryForm } from '../../registry-form';
import { FormField } from '../../../form-feedback/form-feedback';
import { ProfileEditor } from '../profile-editor';
import { profileFieldLabels, type ProfileInitial } from '../../../../lib/profile-validation';
import { SectionWorkspace } from '../../section-workspace';
import { volunteerParticipations } from '../../../../lib/volunteer-participation';
import { Participations } from '../participations';
import { VolunteerUnits } from '../volunteer-units';
import { StatusRibbon } from '../../../status-ribbon';
import Link from 'next/link';
import CoordinationBreadcrumb from '../../breadcrumb';
import { notFound } from 'next/navigation';
import { canAdminister, canOperate, staff } from '../../../../lib/auth';
import { sql } from '../../../../lib/db';
import { displayDate, uuid } from '../../../../lib/registration';
import { recordVolunteerIncident, verifyPolicy } from '../../../staff-actions';

export default async function VolunteerProfile({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ incidente?: string }>;
}) {
  const { id } = await params;
  const user = await staff();
  const admin = canAdminister(user);
  const coordinates = canOperate(user);
  if (!uuid(id) || (!admin && !coordinates)) notFound();
  const [person] = await sql`select *,birth::text from volunteers where id=${id}`;
  if (!person) notFound();
  const { incidente } = await searchParams;
  const showIncidentForm = coordinates && (incidente === 'nuevo' || incidente === 'datos' || incidente === 'vinculo');
  const incidentSection = `/coordinacion/registro/${id}`;
  const [units, policies, incidents, outings] = await Promise.all([
    sql`select name from units order by name`,
    sql`select *,starts::text,ends::text from policies where volunteer_id=${id} order by verified_at desc nulls last`,
    sql`select i.id, i.occurred_on::text, i.description, i.outing_id, o.title
      from volunteer_incidents i left join outings o on o.id = i.outing_id
      where i.volunteer_id = ${id} order by i.occurred_on desc, i.recorded_at desc, i.id`,
    sql`select o.id, o.title, o.starts::text, o.ends::text from outings o
      where exists (select 1 from registrations r where r.volunteer_id = ${id} and r.outing_id = o.id)
      order by o.starts desc, o.title, o.id`,
  ]);
  const participations = await volunteerParticipations(id);
  return <>
    <ContextReturnLink />
    <CoordinationBreadcrumb current={`${person.name} ${person.surname} ${person.second_surname ?? ""}`.trim()} parent={{ href: "/coordinacion/registro", label: "Voluntariado" }} />
    <header className="card">
      <h1>{person.name} {person.surname} {person.second_surname}</h1>
      <p>Identificación <strong>{person.identification}</strong></p>
      <ul className="profile-units" aria-label="Unidades de voluntariado">
        <li><strong>Voluntariado General</strong> · Obligatorio</li>
        {person.units.filter((unit: string) => unit !== 'Voluntariado General').map((unit: string) => <li key={unit}>{unit}</li>)}
      </ul>
    </header>
    <SectionWorkspace urlKey="seccion" initial={incidente?'incidents':'information'} sections={[
      {key:'information',label:'Información personal',content:<>    <div className="profile-overview">
      <section className="card">
        <h2>Contacto y datos personales</h2>
        <dl className="profile-facts">
          <div><dt>Correo</dt><dd>{person.email || 'Pendiente'}</dd></div>
          <div><dt>WhatsApp</dt><dd>{person.whatsapp || 'Pendiente'}</dd></div>
          <div><dt>Fecha de nacimiento</dt><dd>{person.birth ? displayDate(person.birth) : 'Pendiente'}</dd></div>
          <div><dt>Ubicación</dt><dd>{[person.province, person.canton, person.district].filter(Boolean).join(', ') || 'Pendiente'}</dd></div>
          <div><dt>Voluntariado desde</dt><dd>{person.volunteer_year || 'Año pendiente'}</dd></div>
          <div><dt>Persona asociada</dt><dd>{person.member == null ? 'Por confirmar' : person.member ? `Sí · ${person.member_year || 'Año pendiente'}` : 'No'}</dd></div>
        </dl>
        {admin && <ProfileEditor id={String(person.id)} initial={Object.fromEntries(Object.keys(profileFieldLabels).map(name=>[name,
          ['medical','member'].includes(name) ? person[name] == null ? '' : person[name] ? 'sí' : 'no' : String(person[name] ?? ''),
        ])) as ProfileInitial} />}
      </section>
      <section className="card">
        <h2>Emergencias y salud</h2>
        <dl className="profile-facts">
          <div><dt>Contacto de emergencia</dt><dd>{person.emergency_name || 'Pendiente'}</dd></div>
          <div><dt>Teléfono de emergencia</dt><dd>{person.emergency_phone || 'Pendiente'}</dd></div>
          <div><dt>Parentesco</dt><dd>{person.emergency_relation || 'Pendiente'}</dd></div>
          <div><dt>Condición médica</dt><dd>{person.medical == null ? 'Pendiente' : person.medical ? person.medical_detail || 'Declarada' : 'No'}</dd></div>
        </dl>
      </section>
    </div>
</>},
      {key:'participations',label:'Participaciones',content:<>    <Participations rows={participations} canManage={coordinates} name={`${person.name} ${person.surname} ${person.second_surname ?? ""}`.trim()} />
</>},
      {key:'units',label:'Unidades',content:<section className="card"><h2>Unidades de voluntariado</h2><p>Voluntariado General es obligatorio y no puede removerse.</p><ul>{person.units.map((unit:string)=><li key={unit}>{unit}</li>)}</ul>{coordinates&&<VolunteerUnits volunteerId={id} units={units.map(unit=>unit.name)} selected={person.units}/>}</section>},
      {key:'policies',label:'Pólizas',content:<>    <section className="card">
      <h2>Historial de pólizas</h2>
      {policies.length ? <ul className="profile-history">
        {policies.map(policy => <li key={policy.id}>
          <strong>{policy.kind}</strong> · {policy.number}
          <p>{policy.verified_at ? `${displayDate(policy.starts)} al ${displayDate(policy.ends)} · ${policy.source}` : 'Vigencia pendiente'}</p>
        </li>)}
      </ul> : <p>Todavía no hay pólizas registradas.</p>}
      {admin && <RegistryModal kind="policy" title="Verificar póliza" successMessage="Póliza registrada y verificada." saveLabel="Guardar póliza" action={verifyPolicy}><input type="hidden" name="volunteer" value={person.id}/><div className="grid">
        <FormField name="kind" label="Tipo"><input name="kind" required/></FormField><FormField name="number" label="Número de póliza"><input name="number" required/></FormField>
        <FormField name="source" label="Fuente de verificación"><input name="source" required/></FormField>
        <FormField name="starts" label="Vigente desde"><input name="starts" type="date" required/></FormField><FormField name="ends" label="Vigente hasta"><input name="ends" type="date" required/></FormField>
      </div></RegistryModal>}
    </section>
</>},
      {key:'incidents',label:'Incidentes',content:<>    <section className="card" id="incidentes" aria-labelledby="incidents-title">
      <div className="outings-table-heading">
        <h2 id="incidents-title">Historial de incidentes</h2>
        {coordinates && !showIncidentForm && <Link className="button" href={`${incidentSection}?incidente=nuevo#registro-incidente`}>Agregar incidente</Link>}
      </div>
      {coordinates && incidente === 'guardado' && <StatusRibbon message="Incidente registrado." />}
      {showIncidentForm && <section id="registro-incidente" aria-labelledby="incident-form-title">
        <h3 id="incident-form-title">Registro de incidentes</h3>
        {incidente === 'datos' && <p role="alert">Revisá la fecha y la descripción del incidente.</p>}
        {incidente === 'vinculo' && <p role="alert">No se pudo registrar el incidente. Revisá la ficha y la salida seleccionada.</p>}
        <RegistryForm kind="incident" action={recordVolunteerIncident.bind(null, id)} successMessage="Incidente registrado.">
          <FormField name="occurred_on" label="Fecha del incidente"><input name="occurred_on" type="date" required /></FormField>
          <FormField name="outing" label="Salida relacionada">
            <select name="outing" defaultValue="">
              <option value="">Incidente general</option>
              {outings.map(outing => <option key={outing.id} value={outing.id}>
                {outing.title} · {displayDate(outing.starts)} al {displayDate(outing.ends)}
              </option>)}
            </select>
          </FormField>
          <FormField name="description" label="Descripción"><textarea name="description" required maxLength={4000} rows={4} /></FormField>
          <div className="actions">
            <button className="coord-button-primary" type="submit">Registrar incidente</button>
            <Link href={`${incidentSection}#incidentes`}>Cancelar</Link>
          </div>
        </RegistryForm>
      </section>}
      {incidents.length ? <ul className="profile-history">
        {incidents.map(incident => <li key={incident.id}>
          <strong>{displayDate(incident.occurred_on)}</strong> · {incident.outing_id
            ? <Link href={`/coordinacion/salidas/${incident.outing_id}`}>{incident.title}</Link>
            : 'Incidente general'}
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{incident.description}</p>
        </li>)}
      </ul> : <p>Todavía no hay incidentes registrados.</p>}
    </section>
</>},
    ]}/>
  </>;
}
