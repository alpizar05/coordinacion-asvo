import {ContextReturnLink} from '../navigation-context';
import { NavigationResults } from '../navigation-context';
import { randomUUID } from 'node:crypto';
import { ContextDetailLink } from '../navigation-context';
import { ActiveRegistrationFilters } from './active-filters';
import { compactParticipationDates } from '../../../lib/participation-dates';
import { StatusRibbon } from '../../status-ribbon';
import { statuses, statusLabels } from '../registration-statuses';
import CoordinationBreadcrumb from '../breadcrumb';
import { StatusFilter } from './status-filter';
import { RegistrationActions } from '../registration-actions';
import { notFound, redirect } from 'next/navigation';
import { staff, staffScope } from '../../../lib/auth';
import { sql } from '../../../lib/db';
import { date, displayDate, outingIsEditable, uuid } from '../../../lib/registration';

const receivedFormat = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica', dateStyle: 'short', timeStyle: 'short',
});

export default async function Registrations({ searchParams }: {
  searchParams: Promise<{ estado?: string; unidad?: string; desde?: string; hasta?: string; error?: string; inscripcion?: string; gestionada?: string }>;
}) {
  const user = await staff();
  if (!user) redirect('/coordinacion');
  const general = staffScope(user).general;
  const scopes = staffScope(user).units;
  if (!general && !scopes.length) notFound();

  const { estado, unidad, desde, hasta, error, inscripcion, gestionada } = await searchParams;
  const filter = estado === 'todos' || (typeof estado === 'string' && statusLabels.has(estado)) ? estado : 'revisión';
  const status = filter === 'todos' ? '' : filter;
  const units = general ? (await sql<{ name: string }[]>`select name from units order by name`).map(row => row.name) : scopes;
  const unit = typeof unidad === 'string' && units.includes(unidad) ? unidad : '';
  const from = typeof desde === 'string' && date(desde) ? desde : '';
  const to = typeof hasta === 'string' && date(hasta) ? hasta : '';
  const invalidRange = !!from && !!to && from > to;
  const filters = new URLSearchParams({ estado: filter, unidad: unit, desde: from, hasta: to }).toString();
  const rows = await sql<{
    version:string; id: string; outing_id: string; identification: string; status: string; received_at: Date | null;
    starts: string; ends: string; title: string; unit: string; flexible: boolean;
    outing_status: string; outing_start: string; outing_end: string; volunteer: string; volunteer_id: string | null;
  }[]>`
    select r.id,r.outing_id,md5(to_jsonb(r)::text) as version,r.identification,r.status,r.received_at,r.starts::text,r.ends::text,
      o.title,o.unit,o.flexible,o.status as outing_status,o.starts::text as outing_start,o.ends::text as outing_end,
      v.id as volunteer_id, concat_ws(' ',v.name,v.surname,v.second_surname) as volunteer
    from registrations r
    join outings o on o.id=r.outing_id
    left join volunteers v on v.id=r.volunteer_id
    where (${general} or o.unit=any(${scopes}::text[]))
      and not ${invalidRange}::boolean
      and (${unit}='' or o.unit=${unit})
      and (${from || null}::date is null or r.ends >= ${from || null}::date)
      and (${to || null}::date is null or r.starts <= ${to || null}::date)
      and (${status}='' or r.status=${status})
    order by r.received_at desc,r.id`;

  return <><ContextReturnLink/><NavigationResults revision={randomUUID()}/>
    <CoordinationBreadcrumb current="Solicitudes de inscripción" />
    <h1>Solicitudes de inscripción</h1>
    {gestionada && uuid(gestionada) && <StatusRibbon key={gestionada} message="Inscripción actualizada." />}
    <section className="card">
      <div className="coordination-table-toolbar"><StatusFilter value={filter} statuses={statuses} units={units} unit={unit} from={from} to={to} />
      <p role="status" aria-live="polite" aria-atomic="true">{rows.length} {rows.length === 1 ? 'solicitud' : 'solicitudes'}</p></div>
      <ActiveRegistrationFilters status={filter} unit={unit} from={from} to={to} />
      <div className="outings-scroll" tabIndex={0} role="region" aria-label="Tabla de solicitudes de inscripción">
        <table className="outings-table coordination-compact-table registrations-overview-table" data-navigation-list="requests">
          <thead><tr>
            <th scope="col">Persona voluntaria</th><th scope="col">Convocatoria</th><th scope="col">Unidad</th>
            <th scope="col">Fechas solicitadas</th><th scope="col">Recibida</th><th scope="col">Estado</th><th scope="col">Acciones</th>
          </tr></thead>
          <tbody>
            {rows.map(row => <tr id={`inscripcion-${row.id}`} key={row.id}>
              <th scope="row" className="overview-person">{general && row.volunteer_id
                ? <ContextDetailLink anchor={`inscripcion-${row.id}`} href={`/coordinacion/registro/${row.volunteer_id}`}>{row.volunteer}</ContextDetailLink>
                : row.volunteer || 'Ficha pendiente de conciliar'}</th>
              <td data-label="Convocatoria"><ContextDetailLink anchor={`inscripcion-${row.id}`} href={`/coordinacion/salidas/${row.outing_id}#inscripcion-${row.id}`}>{row.title}</ContextDetailLink>
                <br className="overview-outing-dates" /><span className="table-date overview-outing-dates">{displayDate(row.outing_start)} al {displayDate(row.outing_end)}</span></td>
              <td data-label="Unidad">{row.unit}</td>
              <td data-label="Fechas solicitadas" className="table-date"><span className="overview-full-dates">{displayDate(row.starts)} al {displayDate(row.ends)}</span><span className="overview-compact-dates">{compactParticipationDates(row.starts,row.ends)}</span></td>
              <td data-label="Recibida" className="table-date">{row.received_at ? receivedFormat.format(row.received_at) : 'Sin fecha original'}</td>
              <td data-label="Estado"><span className="overview-full-status pill" data-status={row.status}>{statusLabels.get(row.status) ?? row.status}</span>
                <span className="overview-compact-status"><span className="pill" data-status={row.status}>{row.status.startsWith('cancelada') ? 'Cancelada' : statusLabels.get(row.status) ?? row.status}</span>
                {row.status.startsWith('cancelada') && <span className="overview-cancelled-by">{row.status === 'cancelada por coordinación' ? 'Por Coordinación' : 'Por voluntariado'}</span>}</span></td>
              <td data-label="Acciones"><RegistrationActions canManage={outingIsEditable(row.outing_status)} personName={row.volunteer} entry={row} outing={{ flexible: row.flexible, first_day: row.outing_start, last_day: row.outing_end }}
                error={row.id === inscripcion ? error : undefined} fromList filter={filters} /></td>
            </tr>)}
            {!rows.length && <tr><td colSpan={7}>No hay solicitudes que coincidan con los filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
