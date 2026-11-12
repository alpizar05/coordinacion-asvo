import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { staff } from '../../../lib/auth';
import { sql } from '../../../lib/db';
import { date, displayDate } from '../../../lib/registration';
import { compactParticipationDates } from '../../../lib/participation-dates';
import CoordinationBreadcrumb from '../breadcrumb';
import { StatusFilter } from '../inscripciones/status-filter';

const statuses = [['borrador','Borrador'],['finalizado','Finalizado']] as const;
const timestamp = new Intl.DateTimeFormat('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'short',timeStyle:'short'});
export const metadata = { title: 'Informes de salida | ASVO' };

export default async function Reports({ searchParams }: { searchParams: Promise<{estado?:string;unidad?:string;desde?:string;hasta?:string}> }) {
  const user = await staff();
  if (!user) redirect('/coordinacion');
  const general = user.grants.some(grant => grant.role === 'general');
  const scopes = user.grants.filter(grant => grant.role === 'unidad').map(grant => grant.unit);
  if (!general && !scopes.length) notFound();
  const query = await searchParams;
  const status = statuses.some(([value])=>value===query.estado) ? query.estado! : 'todos';
  const units = general ? (await sql<{name:string}[]>`select name from units order by name`).map(row=>row.name) : scopes;
  const unit = units.includes(query.unidad || '') ? query.unidad! : '';
  const from = query.desde && date(query.desde) ? query.desde : '';
  const to = query.hasta && date(query.hasta) ? query.hasta : '';
  const invalidRange = !!from && !!to && from > to;
  const rows = await sql<{id:string;outing_id:string;lead_registration_id:string;lead_name:string;volunteer_id:string|null;title:string;unit:string;starts:string|null;ends:string|null;status:string;submitted_at:Date|null;updated_at:Date}[]>`
    select p.id,p.outing_id,p.lead_registration_id,p.lead_name,r.volunteer_id,o.title,o.unit,
      p.starts::text,p.ends::text,p.status,p.submitted_at,p.updated_at
    from outing_reports p join outings o on o.id=p.outing_id
    left join registrations r on r.id=p.lead_registration_id and r.outing_id=p.outing_id
    where (${general} or o.unit=any(${scopes}::text[])) and not ${invalidRange}
      and (${status}='todos' or p.status=${status}) and (${unit}='' or o.unit=${unit})
      and (${from || null}::date is null or coalesce(p.ends,o.ends)>=${from || null}::date)
      and (${to || null}::date is null or coalesce(p.starts,o.starts)<=${to || null}::date)
    order by coalesce(p.submitted_at,p.updated_at) desc,p.id`;
  function url(remove: string) {
    const next = new URLSearchParams();
    if(status!=='todos' && remove!=='estado') next.set('estado',status);
    if(unit && remove!=='unidad') next.set('unidad',unit);
    if(from && remove!=='fechas') next.set('desde',from);
    if(to && remove!=='fechas') next.set('hasta',to);
    return `/coordinacion/informes?${next}`;
  }
  const chips = [
    ...(status!=='todos'?[{key:'estado',label:status==='borrador'?'Borrador':'Finalizado'}]:[]),
    ...(unit?[{key:'unidad',label:unit}]:[]),
    ...(from||to?[{key:'fechas',label:from&&to?`${displayDate(from)} – ${displayDate(to)}`:from?`Desde ${displayDate(from)}`:`Hasta ${displayDate(to)}`}]:[]),
  ];
  return <>
    <CoordinationBreadcrumb current="Informes de salida" /><h1>Informes de salida</h1>
    <section className="card">
      <div className="coordination-table-toolbar">
        <StatusFilter path="/coordinacion/informes" title="Filtrar informes" value={status} statuses={statuses} units={units} unit={unit} from={from} to={to} />
        <p role="status">{rows.length} {rows.length===1?'informe':'informes'}</p>
      </div>
      {!!chips.length && <nav className="registration-active-filters" aria-label="Filtros activos de informes">
        {chips.map(chip=><Link key={chip.key} href={url(chip.key)} scroll={false} className="active-filter-chip" aria-label={`Quitar filtro: ${chip.label}`}><span className="active-filter-chip-content">{chip.label}<span aria-hidden="true">×</span></span></Link>)}
        <Link href="/coordinacion/informes" className="active-filter-reset" scroll={false}>Restablecer</Link>
      </nav>}
      <div className="outings-scroll" tabIndex={0} role="region" aria-label="Tabla de informes de salida">
        <table className="outings-table coordination-compact-table reports-overview-table">
          <thead><tr><th scope="col">Responsable (70)</th><th scope="col">Convocatoria</th><th scope="col">Unidad</th><th scope="col">Fechas de la gira</th><th scope="col">Última actualización</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
          <tbody>{rows.map(row=><tr key={row.id}>
            <th scope="row">{general && row.volunteer_id?<Link href={`/coordinacion/registro/${row.volunteer_id}`}>{row.lead_name}</Link>:row.lead_name}</th>
            <td data-label="Convocatoria"><Link href={`/coordinacion/salidas/${row.outing_id}`}>{row.title}</Link></td>
            <td data-label="Unidad">{row.unit}</td>
            <td data-label="Fechas">{row.starts && row.ends?compactParticipationDates(row.starts,row.ends):'Sin completar'}</td>
            <td data-label="Actualizado">{timestamp.format(row.submitted_at || row.updated_at)}</td>
            <td data-label="Estado"><span className="pill" data-status={row.status}>{row.status==='finalizado'?'Finalizado':'Borrador'}</span></td>
            <td data-label="Acciones"><Link href={`/coordinacion/salidas/${row.outing_id}/resumen?informe=${row.lead_registration_id}#informe-${row.lead_registration_id}`}>Ver informe</Link></td>
          </tr>)}{!rows.length && <tr><td colSpan={7}>No hay informes que coincidan con los filtros.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </>;
}
