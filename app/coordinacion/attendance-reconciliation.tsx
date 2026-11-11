import { attendanceCases,attendanceDecisionLabels, type AttendanceDecision } from '../../lib/attendance-reconciliation';
import { displayDate } from '../../lib/registration';
import { ActionModal } from './action-modal';
import { reconcileAttendance } from './attendance-actions';

const timestamp = (value:string|Date) => new Intl.DateTimeFormat('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
type Report = { id:string;lead:string;starts:string;ends:string;observations:string;submitted:string;attended:boolean;absent:boolean };
type Decision = {decision:AttendanceDecision;reason:string;actor:string;created:string};
export async function AttendanceReconciliation({ outingId, canResolve }: {outingId:string;canResolve:boolean}) {
  const cases = await attendanceCases(outingId);
  return <section className="card" id="asistencia" aria-labelledby="attendance-title"><h2 id="attendance-title">Asistencia</h2>
    <p className="muted">Revisá las diferencias entre informes finalizados. Las resoluciones no modifican los informes originales ni calculan días u horas trabajadas.</p>
    {!cases.length && <p>No hay diferencias de asistencia por conciliar en los informes registrados.</p>}
    <ul className="attendance-cases">{cases.map(item=>{
      const reports = item.reports as Report[];
      const resolved = item.current_resolution && item.decision !== 'pendiente';
      return <li key={item.volunteer_id}><h3>{item.name}</h3>
        <p>Fechas inscritas: {(item.dates as {starts:string;ends:string}[]).map(date=>`${displayDate(date.starts)} al ${displayDate(date.ends)}`).join(' · ')}</p>
        <p><strong>{resolved ? `Conciliado: ${attendanceDecisionLabels[item.decision as AttendanceDecision]}` : item.resolution_id && !item.current_resolution ? 'Nuevos informes o evidencia modificada: requiere revisión' : 'Asistencia por conciliar'}</strong></p>
        {canResolve && <ActionModal title={item.resolution_id ? 'Revisar resolución de asistencia' : 'Revisar asistencia'} saveLabel="Guardar resolución" successMessage="Resolución de asistencia guardada." action={reconcileAttendance.bind(null,outingId,item.volunteer_id)} wide>
          <p><strong>{item.name}</strong></p>
          <input type="hidden" name="version" value={item.version} />
          <ul className="attendance-reports">{reports.map(report=><li key={report.id}>
            <strong>{report.lead}</strong><p>{report.attended && report.absent ? 'Asistencia contradictoria en el mismo informe' : report.attended ? 'Participó' : 'No participó'}</p>
            <p className="muted">Periodo del informe: {displayDate(report.starts)} al {displayDate(report.ends)} · Finalizado: {timestamp(report.submitted)}</p>
            <p className="copy">{report.observations || 'Sin observaciones en el informe.'}</p>
          </li>)}</ul>
          <label>Decisión<select name="decision" required defaultValue=""><option value="" disabled>Seleccioná una decisión</option>
            {Object.entries(attendanceDecisionLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select></label>
          <label>Motivo de la resolución<textarea name="reason" required maxLength={4000} /></label>
          <p className="muted">Participó suma esta salida una vez a la trayectoria. No participó no la suma. Mantener pendiente conserva el caso fuera del total hasta resolverlo.</p>
        </ActionModal>}
        {!!item.history.length && <details><summary>Historial de resoluciones ({item.history.length})</summary>
          <ol className="attendance-history">{(item.history as Decision[]).map((entry,index)=><li key={index}>
            <strong>{attendanceDecisionLabels[entry.decision]}</strong><p>{timestamp(entry.created)} · Responsable registrado: {entry.actor}</p><p className="copy">{entry.reason}</p>
          </li>)}</ol>
        </details>}
      </li>;
    })}</ul>
  </section>;
}
