import { MobileDisclosure } from './mobile-disclosure';
import { ContextDetailLink } from './navigation-context';
import { registrationLogistics } from '../../lib/registration-logistics';
import { statusLabels } from './registration-statuses';

export function TransportSummary({ entries, canViewProfile }: {
  entries: { id: string; status: string; volunteer: string; volunteer_id: string | null; details: Record<string, unknown> | null }[];
  canViewProfile: boolean;
}) {
  const transport = entries.filter(entry => ['confirmada', 'revisión'].includes(entry.status))
    .map(entry => ({ ...entry, logistics: registrationLogistics(entry.details) }))
    .filter(entry => entry.logistics.transport)
    .sort((a, b) => Number(b.status === 'confirmada') - Number(a.status === 'confirmada'));
  if (!transport.length) return <p className="muted" data-navigation-list-container="transport" tabIndex={-1}>Sin transporte propio indicado para esta salida.</p>;
  const confirmed = transport.filter(entry => entry.status === 'confirmada');
  const seats = confirmed.reduce((sum, entry) => sum + entry.logistics.seats, 0);
  const pending = transport.filter(entry => entry.status === 'revisión').reduce((sum, entry) => sum + entry.logistics.seats, 0);
  const unknown = transport.filter(entry => entry.logistics.legacySeats).length;

  return <section data-navigation-list-container="transport" tabIndex={-1} className="transport-summary" aria-label="Resumen de transporte">
    <h3>Transporte · Personas confirmadas</h3>
    <div className="transport-summary-totals">
      <p><strong>{confirmed.length}</strong> {confirmed.length === 1 ? 'persona con vehículo propio' : 'personas con vehículo propio'}</p>
      <p><strong>{seats}</strong> {seats === 1 ? 'espacio ofrecido' : 'espacios ofrecidos'}</p>
    </div>
    {pending > 0 && <p className="muted">{pending} {pending === 1 ? 'espacio adicional pendiente' : 'espacios adicionales pendientes'} de confirmación</p>}
    {unknown > 0 && <p className="muted">{unknown} {unknown === 1 ? 'persona ofreció' : 'personas ofrecieron'} transporte sin indicar cantidad; esos espacios no se incluyen en los totales.</p>}
    <MobileDisclosure navigationDisclosure="transporte" title="Ver transporte" className="transport-summary-detail" desktopSummary={<><span className="transport-summary-show">Ver transporte</span><span className="transport-summary-hide">Ocultar transporte</span></>}>
      <h4>Transporte ofrecido</h4>
      <div className="outings-scroll" tabIndex={0} role="region" aria-label="Detalle de transporte ofrecido">
        <table data-navigation-list="transport" className="outings-table coordination-compact-table compact-transport"><thead><tr>
          <th scope="col">Persona voluntaria</th><th scope="col">Inscripción</th><th scope="col">Personas que puede llevar</th>
        </tr></thead><tbody>{transport.map(entry => <tr key={entry.id} id={`transporte-${entry.id}`}>
          <th scope="row">{canViewProfile && entry.volunteer_id
            ? <ContextDetailLink anchor={`transporte-${entry.id}`} href={`/coordinacion/registro/${entry.volunteer_id}`}>{entry.volunteer}</ContextDetailLink>
            : entry.volunteer || 'Ficha pendiente de conciliar'}</th>
          <td data-label="Inscripción"><span className="pill" data-status={entry.status}>{statusLabels.get(entry.status) ?? entry.status}</span></td>
          <td data-label="Personas que puede llevar">{entry.logistics.legacySeats ? 'Cantidad no indicada' : entry.logistics.seats}</td>
        </tr>)}</tbody></table>
      </div>
      <p className="muted">Los {seats} espacios corresponden a personas confirmadas. No representan traslados asignados.</p>
    </MobileDisclosure>
  </section>;
}
