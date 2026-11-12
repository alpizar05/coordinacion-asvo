import {randomUUID} from 'node:crypto';
import {ContextDetailLink,ContextReturnLink,NavigationResults} from './navigation-context';
import { ReportReminder } from './report-reminder';
import { SummaryViewSelector } from './summary-view-selector';
import { SummaryFilters } from './summary-filters';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { staff } from '../../lib/auth';
import { demo, sql } from '../../lib/db';
import { coordinationSummary } from '../../lib/coordination-summary';
import { displayDate } from '../../lib/registration';
import { login } from '../staff-actions';
import CoordinationBreadcrumb from './breadcrumb';
import { RegistrationActions } from './registration-actions';
import { SummaryPreferences, SummaryRefresh } from './summary-preferences';
import { StatusRibbon } from '../status-ribbon';

const startLabel = (days: number) => days < 0 ? `Comenzó hace ${-days} días` : days === 0 ? 'Comienza hoy' : days === 1 ? 'Comienza mañana' : `Comienza en ${days} días`;
export default async function Page({ searchParams }: { searchParams: Promise<{ unidad?: string; dias?: string; pestana?: string; gestionada?: string; inscripcion?: string; error?: string }> }) {
  const user = await staff();
  if (!user) return <><h1>Coordinación</h1><form className="card" action={login}>{demo ? <><p>Entorno local con datos ficticios.</p><div className="actions"><button name="role" value="admin">Entrar como administrador</button><button name="role" value="general">Entrar como coordinación</button></div></> : <button>Entrar con Microsoft</button>}</form></>;
  const general = user.grants.some(grant => grant.role === 'general');
  const scopes = user.grants.filter(grant => grant.role === 'unidad').map(grant => grant.unit);
  if (!general && !scopes.length) {
    if (user.grants.some(grant => grant.role === 'admin')) redirect('/coordinacion/administracion');
    return <><h1>Coordinación</h1><p>Tu cuenta está a la espera de permisos de ASVO.</p></>;
  }
  const params = await searchParams;
  const units = await sql<{name:string}[]>`select name from units where ${general} or name=any(${scopes}::text[]) order by name`;
  const unit = units.some(item => item.name === params.unidad) ? params.unidad! : '';
  const days = params.dias === '30' ? 30 : params.dias === '14' ? 14 : 7;
  const { reviews,upcoming,reports,reportPeople } = await coordinationSummary(general,scopes,unit,days);
  const withoutLead = upcoming.filter(item => !item.leads);
  const defaultTab = reviews.some(item => item.days_to_start <= 1) ? 'revision'
    : withoutLead.some(item => item.days_to_start <= 1) ? 'sin70'
    : reports.length ? 'informes' : reviews.length ? 'revision' : withoutLead.length ? 'sin70' : 'revision';
  const tab = ['revision','sin70','informes'].includes(params.pestana || '') ? params.pestana! : defaultTab;
  const filters = new URLSearchParams({ unidad:unit,dias:String(days),pestana:tab });
  const url = (next: string) => `/coordinacion?${new URLSearchParams({ unidad:unit,dias:String(days),pestana:next })}`;
  const updated = new Intl.DateTimeFormat('es-CR',{ timeZone:'America/Costa_Rica',hour:'2-digit',minute:'2-digit' }).format(new Date());
  const reviewCount = Number(reviews[0]?.total || 0), reportCount = Number(reports[0]?.total || 0);
  const tabs = [['revision','Inscripciones en revisión',reviewCount],['sin70','Sin 70',withoutLead.length],['informes','Informes pendientes',reportCount]] as const;
  return <><NavigationResults revision={randomUUID()}/><ContextReturnLink/>
    <SummaryPreferences subject={user.subject} unit={unit} days={days} tab={tab} explicit={!!(params.unidad !== undefined || params.dias || params.pestana)} />
    <CoordinationBreadcrumb current="Resumen" />
    <div className="summary-heading"><div className="summary-title"><h1>Resumen</h1><p className="muted">Actualizado a las {updated} · Costa Rica</p></div>
      <div className="actions summary-actions"><SummaryRefresh /><Link className="button coord-button-primary" href="/coordinacion/salidas/nueva">Nueva convocatoria</Link></div>
      <div className="summary-filter-toolbar"><SummaryFilters unit={unit} days={days} tab={tab} units={units.map(item => item.name)} /></div>
    </div>
    <div id="summary-active-filters" />
    {params.gestionada && <StatusRibbon message="Inscripción gestionada. Los pendientes se actualizaron." />}
    <div className="summary-dashboard">
      <section className="card" aria-labelledby="summary-attention" data-navigation-list-container="summary-attention" tabIndex={-1}><h2 id="summary-attention">Requiere atención</h2>
        {!reviewCount && !withoutLead.length && !reportCount && <p className="summary-clear">Todo al día. No hay pendientes para esta selección.</p>}
        <SummaryViewSelector selected={tab} options={tabs.map(([key,label,count]) => ({key,label,count,href:url(key)}))} />
        <ul className="summary-list" data-navigation-list="summary-attention">
          {tab === 'revision' && reviews.map(row => <li key={row.id} data-navigation-item id={`summary-review-${row.id}`}>
            <div><strong>{row.volunteer || 'Ficha pendiente de conciliar'}</strong><p><ContextDetailLink anchor={`summary-review-${row.id}`} href={`/coordinacion/salidas/${row.outing_id}`}>{row.title}</ContextDetailLink></p>
              <p>{displayDate(row.starts)} al {displayDate(row.ends)}</p><p className="muted">{row.age === 0 ? 'Recibida hoy' : `Recibida hace ${row.age} días`} · {startLabel(row.days_to_start)}</p></div>
            <RegistrationActions personName={row.volunteer} entry={{version:row.version,id:row.id,status:row.status,identification:row.identification,starts:row.starts,ends:row.ends}}
              outing={{flexible:row.flexible,first_day:row.outing_start,last_day:row.outing_end}} fromList filter={filters.toString()} fromSummary
              error={params.inscripcion === row.id ? params.error : undefined} />
          </li>)}
          {tab === 'sin70' && withoutLead.map(row => <li key={row.id} data-navigation-item id={`summary-no-lead-${row.id}`}><div><strong><ContextDetailLink anchor={`summary-no-lead-${row.id}`} href={`/coordinacion/salidas/${row.id}`}>{row.title}</ContextDetailLink></strong>
            <p>{startLabel(row.days_to_start)} · {displayDate(row.starts)} al {displayDate(row.ends)}</p>
            <p className="muted">{row.confirmed ? `${row.confirmed} confirmadas · ${row.interested} con interés en ser 70` : 'Todavía no hay personas confirmadas para asignar como 70.'}</p></div>
            <ContextDetailLink anchor={`summary-no-lead-${row.id}`} href={`/coordinacion/salidas/${row.id}#inscripciones`}>Ver inscripciones</ContextDetailLink></li>)}
          {tab === 'informes' && reports.map(row => <li key={row.id} className="summary-report-row" data-navigation-item id={`summary-report-${row.id}`}><div><strong><ContextDetailLink anchor={`summary-report-${row.id}`} href={`/coordinacion/salidas/${row.id}`}>{row.title}</ContextDetailLink></strong>
            <p>{displayDate(row.starts || row.ends)} al {displayDate(row.ends)} · Finalizó hace {row.age} {row.age === 1 ? 'día' : 'días'}</p>
            {!row.missing && <p className="muted">Falta definir quién presentará el informe. No hay una persona asignada como 70.</p>}
            <ul className="summary-report-people">{reportPeople.filter(person => person.outing_id === row.id).map(person => <li key={person.id}>
              <p><strong>70: {person.name}</strong> · {person.submitted ? 'Informe finalizado' : person.draft ? 'Borrador guardado · Sin finalizar' : 'Informe sin presentar'}</p>
              {!person.submitted && <>
                <p className="muted">Enlace del informe: {person.active_link ? 'Vigente' : 'Sin enlace vigente'}</p>
                <p className="muted">Último recordatorio: {person.reminded_at ? new Intl.DateTimeFormat('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'short',timeStyle:'short'}).format(person.reminded_at) : 'Todavía no enviado'}
                  {person.reminded_at && <> · {person.demo_mail_id ? 'Disponible en bandeja de prueba' : person.cancelled_at ? 'Cancelado: dejó de corresponder' : person.sent_at ? 'Enviado' : 'Pendiente de envío'}</>}</p>
                {person.reminded_by && <p className="muted">Solicitado por: {person.reminded_by}</p>}
                {person.pending ? <p role="status">Hay un recordatorio pendiente. Se reintentará automáticamente.</p>
                  : person.email ? <ReportReminder outingId={row.id} registrationId={person.id} name={person.name} email={person.email}
                    title={row.title} starts={displayDate(row.starts || row.ends)} ends={displayDate(row.ends)} activeLink={person.active_link} demo={demo} />
                    : <p className="note">Sin correo registrado. Administración debe actualizar la ficha antes de enviar.</p>}
              </>}
            </li>)}</ul>
            <ContextDetailLink anchor={`summary-report-${row.id}`} href={`/coordinacion/salidas/${row.id}?pestana=herramientas`}>Ver seguimiento de la salida</ContextDetailLink></div></li>)}
        </ul>
        {!(tab === 'revision' ? reviews.length : tab === 'sin70' ? withoutLead.length : reports.length) && <p>No hay pendientes en esta categoría.</p>}
        {tab === 'revision' && reviewCount > reviews.length && <ContextDetailLink anchor={reviews[0]?`summary-review-${reviews[0].id}`:'summary-review-00000000-0000-4000-8000-000000000000'} href={`/coordinacion/inscripciones?estado=${encodeURIComponent('revisión')}&unidad=${encodeURIComponent(unit)}`}>Ver las {reviewCount} inscripciones en revisión</ContextDetailLink>}
        {tab === 'informes' && reportCount > reports.length && <p>Se muestran las 100 salidas más antiguas de {reportCount} pendientes.</p>}
      </section>
      <section className="card" aria-labelledby="summary-upcoming" data-navigation-list-container="summary-upcoming" tabIndex={-1}><h2 id="summary-upcoming">Próximas salidas</h2>
        <p className="muted">Próximos {days} días · {upcoming.length} salidas</p>
        <ul className="summary-list" data-navigation-list="summary-upcoming" id="summary-upcoming-00000000-0000-4000-8000-000000000000">{upcoming.map(row => <li key={row.id} data-navigation-item id={`summary-upcoming-${row.id}`}><div><strong><ContextDetailLink anchor={`summary-upcoming-${row.id}`} href={`/coordinacion/salidas/${row.id}`}>{row.title}</ContextDetailLink></strong>
          <p>{displayDate(row.starts)} al {displayDate(row.ends)} · {row.unit}</p>
          <p>{row.occupied}/{row.capacity} inscripciones{row.waiting ? ` · ${row.waiting} en espera` : ''}</p>
          <p><strong>70:</strong> {row.leads || 'Sin asignar'}</p><p className="muted">{row.drivers ? `${row.drivers} ${row.drivers === 1 ? 'persona confirmada tiene' : 'personas confirmadas tienen'} transporte propio` : 'Sin transporte propio indicado por personas confirmadas'}</p>
          <ContextDetailLink anchor={`summary-upcoming-${row.id}`} href={`/coordinacion/salidas/${row.id}?pestana=logistica`}>Ver logística</ContextDetailLink>
        </div></li>)}</ul>
        {!upcoming.length && <p>No hay salidas próximas para esta selección.</p>}
        <ContextDetailLink anchor={upcoming[0]?`summary-upcoming-${upcoming[0].id}`:'summary-upcoming-00000000-0000-4000-8000-000000000000'} href="/coordinacion/convocatorias">Ver convocatorias de salida</ContextDetailLink>
      </section>
    </div>
  </>;
}
