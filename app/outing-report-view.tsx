import type { OutingReport } from '../lib/outing-report';
import { displayDate } from '../lib/registration';

const timestamp = new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Costa_Rica' });
export function OutingReportView({ report }: { report: OutingReport }) {
  return <article className="outing-report-view">
    <dl className="profile-facts">
      <div><dt>Persona responsable (70)</dt><dd>{report.lead_name}</dd></div>
      <div><dt>Correo electrónico</dt><dd>{report.lead_email}</dd></div>
      <div><dt>Estado</dt><dd>{report.status === 'borrador' ? 'Borrador · Informe pendiente' : 'Finalizado'}</dd></div>
      <div><dt>Finalizado</dt><dd>{report.submitted_at ? timestamp.format(new Date(report.submitted_at)) : 'Todavía no finalizado'}</dd></div>
      <div><dt>Última actualización</dt><dd>{timestamp.format(new Date(report.updated_at))}</dd></div>
      <div><dt>Tipo de labor realizada</dt><dd>{report.labour_types.length ? report.labour_types.join(', ') : report.labour}</dd></div>
      <div><dt>Lugar visitado</dt><dd>{report.location}</dd></div>
      <div><dt>Tipo de gira</dt><dd>{report.activity}</dd></div>
      <div><dt>Fechas reales</dt><dd>{report.starts ? displayDate(report.starts) : 'Sin indicar'} al {report.ends ? displayDate(report.ends) : 'Sin indicar'}</dd></div>
      <div><dt>Persona funcionaria o responsable de la actividad</dt><dd>{report.host}</dd></div>
    </dl>
    <h3>Acciones realizadas</h3><p className="copy">{report.actions}</p>
    <h3>Observaciones y recomendaciones</h3><p className="copy">{report.observations || 'Sin observaciones.'}</p>
    <h3>{report.status === 'borrador' ? 'Selección provisional de asistencia' : 'Asistencia confirmada por el 70'}</h3>
    <p>{report.participants.filter(person => person.attended).length} de {report.participants.length} personas {report.status === 'borrador' ? 'seleccionadas en el borrador' : 'participaron'}.</p>
    <ul className="brief-notes">{report.participants.map(person => <li key={person.id}><strong>{person.name}</strong> · {report.status === 'borrador' ? (person.attended ? 'Seleccionada provisionalmente' : 'Sin seleccionar') : person.attended ? 'Participó' : 'No participó'}</li>)}</ul>
  </article>;
}
