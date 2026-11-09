import { displayDate } from '../../lib/registration';
import { registrationLogistics } from '../../lib/registration-logistics';
import { statusLabels } from './registration-statuses';

export function RegistrationDetails({ entry, general }: {
  entry: { volunteer: string; identification: string; status: string; starts: string; ends: string;
    covered: boolean; assigned70: boolean | null; details: Record<string, unknown> | null };
  general: boolean;
}) {
  const data = registrationLogistics(entry.details);
  return <div className="registration-details-content">
    <p><strong>{entry.volunteer || 'Ficha pendiente de conciliar'}</strong></p>
    <section aria-label="Participación">
      <h3>Participación</h3>
      <dl className="profile-facts">
        <div><dt>Identificación</dt><dd>{entry.identification}</dd></div>
        <div><dt>Estado</dt><dd>{statusLabels.get(entry.status) ?? entry.status}</dd></div>
        <div><dt>Llegada</dt><dd>{displayDate(entry.starts)}</dd></div>
        <div><dt>Regreso</dt><dd>{displayDate(entry.ends)}</dd></div>
        <div><dt>Póliza para las fechas solicitadas</dt><dd>{entry.covered ? 'Comprobada' : 'Pendiente'}</dd></div>
      </dl>
    </section>
    <section aria-label="Transporte">
      <h3>Transporte</h3>
      <dl className="profile-facts">
        <div><dt>Transporte propio</dt><dd>{data.transport ? 'Sí' : 'No indicó transporte propio'}</dd></div>
        <div><dt>Personas que puede llevar</dt><dd>{data.legacySeats ? 'Ofreció transporte sin indicar cantidad' : data.seats}</dd></div>
      </dl>
    </section>
    <section aria-label="Alimentación">
      <h3>Restricciones alimentarias</h3>
      <p className="copy">{data.food || 'No indicó restricciones.'}</p>
    </section>
    {(general || data.interested70 || entry.assigned70) && <section aria-label="Responsabilidad de 70">
      <h3>Responsabilidad de 70</h3>
      <dl className="profile-facts">
        <div><dt>Interés expresado</dt><dd>{data.interested70 ? 'Sí, le interesa asumir la responsabilidad' : 'No indicó interés'}</dd></div>
        <div><dt>Asignación actual</dt><dd>{entry.assigned70 ? 'Asignada como 70 por Coordinación' : 'Sin asignación de 70'}</dd></div>
      </dl>
    </section>}
    <section aria-label="Observaciones">
      <h3>Otro detalle para esta salida</h3>
      <p className="copy">{data.other || 'No indicó observaciones.'}</p>
    </section>
  </div>;
}
