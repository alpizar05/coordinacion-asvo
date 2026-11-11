import type { registrationHistory } from '../../lib/registration-history';

type History = Awaited<ReturnType<typeof registrationHistory>>;
const timestamp = (value: string) => new Intl.DateTimeFormat('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const actorLabel = (actor: string) => actor === 'voluntariado' ? 'Persona voluntaria' : actor === 'sistema' ? 'Sistema' : actor === 'local-coordination' ? 'Coordinación de prueba' : `Responsable registrado: ${actor}`;

export function RegistrationHistoryView({ history, received }: { history: History; received: string | null }) {
  return <section className="registration-history" aria-label="Historial de la inscripción">
    <h3>Historial de la inscripción</h3>
    <p className="muted">Hora de Costa Rica. Se muestra la evidencia registrada; algunos eventos antiguos no incluyen el detalle de los cambios o el nombre de quien los realizó.</p>
    {!received && <p className="muted">Fecha de recepción original no disponible.</p>}
    <ol className="registration-timeline">
      {received && !history.events.some(event=>event.action === 'Recibió inscripción') && <li>
        <time dateTime={received}>{timestamp(received)}</time><strong>Fecha de recepción registrada</strong><p className="muted">Responsable no registrado para este evento.</p>
      </li>}
      {history.events.map(event => <li key={event.id}><time dateTime={event.happened_at}>{timestamp(event.happened_at)}</time>
        <strong>{event.action}</strong><p className="muted">{actorLabel(event.actor)}</p>{event.reason && <p className="copy">{event.reason}</p>}
        {event.action.startsWith('Editó inscripción') && !event.reason && <p className="muted">No se registró el detalle de esta edición.</p>}
      </li>)}
    </ol>
    <h3>Notificaciones relacionadas</h3>
    <p className="muted">El correo se muestra por separado de la acción que lo originó. «Enviado» indica que Microsoft aceptó el envío; no confirma lectura.</p>
    {history.mail.length ? <ul className="registration-mail-history">{history.mail.map(mail => <li key={`${mail.source}-${mail.id}`}>
      <strong>{mail.subject}</strong><span className="pill">{mail.source === 'demo' ? 'Bandeja de prueba' : mail.cancelled_at ? 'Cancelado' : mail.sent_at ? 'Enviado' : 'Pendiente'}</span>
      <p>Destinatario: {mail.recipient}</p>
      <p className="muted">{mail.created_at ? `Registrado: ${timestamp(mail.created_at)}` : 'Fecha de registro no disponible'}</p>
      {mail.sent_at && <p className="muted">Enviado: {timestamp(mail.sent_at)}</p>}
      {mail.cancelled_at && <p className="muted">Cancelado: {timestamp(mail.cancelled_at)} · El recordatorio dejó de corresponder.</p>}
      {mail.source === 'correo' && <p className="muted">Intentos registrados: {mail.attempts}{!mail.sent_at && !mail.cancelled_at && mail.attempts > 0 && mail.retry_at ? ` · Reintento habilitado desde ${timestamp(mail.retry_at)}` : ''}</p>}
    </li>)}</ul> : <p>No hay correos vinculados en el registro disponible.</p>}
    <p className="muted">Los correos de prueba anteriores a este historial no tenían vínculo con la inscripción y pueden no aparecer aquí. No se muestran enlaces privados ni tokens.</p>
  </section>;
}
