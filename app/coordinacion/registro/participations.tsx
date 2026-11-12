import { NavigationResults } from '../navigation-context';
import { randomUUID } from 'node:crypto';
import { ContextDetailLink } from '../navigation-context';
import { participationResult, participationSummary, type ParticipationRow } from '../../../lib/volunteer-participation';
import { displayDate } from '../../../lib/registration';
import { statusLabels } from '../registration-statuses';
import { RegistrationActions } from '../registration-actions';

export function Participations({ rows, canManage, name }: { rows:ParticipationRow[]; canManage:boolean; name:string }) {
  const summary = participationSummary(rows);
  return <><NavigationResults revision={randomUUID()}/><section className="card" id="participaciones" aria-labelledby="participation-title">
    <h2 id="participation-title">Trayectoria y participaciones</h2>
    <dl className="volunteer-trajectory-summary">
      <div><dt>Salidas con participación confirmada</dt><dd>{summary.attended}</dd></div>
      <div><dt>Salidas con informe finalizado como 70</dt><dd>{summary.lead}</dd></div>
      <div><dt>Informes pendientes como 70</dt><dd>{summary.pending}</dd></div>
      <div><dt>Última salida con participación confirmada</dt><dd>{summary.last ? <>{canManage ? <ContextDetailLink anchor={`participacion-${summary.last.id}`} href={`/coordinacion/salidas/${summary.last.outing_id}`}>{summary.last.title}</ContextDetailLink> : summary.last.title}
        <small>Fechas publicadas: {displayDate(summary.last.outing_start)} al {displayDate(summary.last.outing_end)}</small></> : 'Sin participación acreditada todavía'}</dd></div>
    </dl>
    <p className="muted">Cada salida se cuenta una sola vez. La asistencia proviene de informes finalizados; una inscripción, un cupo confirmado o un borrador no acreditan participación. Las fechas inscritas no representan días u horas reales trabajadas.</p>
    {summary.conflicts > 0 && <p className="note">Hay {summary.conflicts} {summary.conflicts === 1 ? 'salida con asistencia por conciliar' : 'salidas con asistencia por conciliar'}. Los informes finalizados discrepan; estas salidas no se suman a la participación confirmada.</p>}
    {rows.length ? <div className="outings-scroll" role="region" aria-label="Participaciones de la persona voluntaria" tabIndex={0}>
      <table className="outings-table coordination-compact-table volunteer-participations" data-navigation-list="participations" role="table">
        <thead><tr><th scope="col">Salida</th><th scope="col">Fechas inscritas</th><th scope="col">Inscripción</th><th scope="col">Participación real</th><th scope="col">Responsabilidad</th>{canManage && <th scope="col">Acciones</th>}</tr></thead>
        <tbody>{rows.map(row => <tr id={`participacion-${row.id}`} key={row.id}>
          <th scope="row">{canManage ? <ContextDetailLink anchor={`participacion-${row.id}`} href={`/coordinacion/salidas/${row.outing_id}`}>{row.title}</ContextDetailLink> : row.title}<small className="trajectory-unit">{row.unit}</small></th>
          <td data-label="Fechas inscritas">{displayDate(row.starts)} al {displayDate(row.ends)}</td>
          <td data-label="Inscripción"><span className="pill" data-status={row.status}>{statusLabels.get(row.status) || row.status}</span></td>
          <td data-label="Participación real">{participationResult(row)}{row.resolution_stale && <small className="trajectory-unit">La resolución anterior requiere revisión.</small>}{row.attended && row.absent && canManage && <small className="trajectory-unit"><ContextDetailLink anchor={`participacion-${row.id}`} href={`/coordinacion/salidas/${row.outing_id}?pestana=herramientas#asistencia`}>Revisar asistencia</ContextDetailLink></small>}</td>
          <td data-label="Responsabilidad">{row.lead_report ? '70 · Informe finalizado' : row.assigned70 ? '70 asignado' : 'Integrante'}{row.pending_report && <small className="trajectory-unit">Informe pendiente</small>}</td>
          {canManage && <td data-label="Acciones"><RegistrationActions personName={name} canManage={false} entry={{id:row.id,version:'',status:row.status,identification:'',starts:row.starts,ends:row.ends}}
            outing={{flexible:row.flexible,first_day:row.outing_start,last_day:row.outing_end}} /></td>}
        </tr>)}</tbody>
      </table>
    </div> : <p>Todavía no hay inscripciones o participaciones registradas para esta persona.</p>}
    <p className="muted">Se muestra la trayectoria disponible en la plataforma. La ausencia de registros no significa que la persona no haya participado anteriormente en ASVO.</p>
  </section></>;
}
