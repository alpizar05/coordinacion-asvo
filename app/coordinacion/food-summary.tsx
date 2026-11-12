import { MobileDisclosure } from './mobile-disclosure';
import { ContextDetailLink } from './navigation-context';
import { registrationLogistics } from '../../lib/registration-logistics';

export function FoodSummary({ entries, canViewProfile }: {
  entries: { id: string; status: string; volunteer: string; volunteer_id: string | null; details: Record<string, unknown> | null }[];
  canViewProfile: boolean;
}) {
  const restrictions = entries.filter(entry => entry.status === 'confirmada')
    .map(entry => ({ ...entry, food: registrationLogistics(entry.details).food }))
    .filter(entry => entry.food);

  if (!restrictions.length) return <p className="muted food-summary-empty" data-navigation-list-container="food" tabIndex={-1}>Sin restricciones alimentarias indicadas entre las personas confirmadas.</p>;

  return <section data-navigation-list-container="food" tabIndex={-1} className="transport-summary food-summary" aria-label="Resumen de alimentación">
    <h3>Alimentación · Personas confirmadas</h3>
    <div className="transport-summary-totals">
      <p><strong>{restrictions.length}</strong> {restrictions.length === 1 ? 'persona indicó' : 'personas indicaron'} restricciones alimentarias</p>
    </div>
    <MobileDisclosure navigationDisclosure="alimentacion" title="Ver restricciones" className="transport-summary-detail" desktopSummary={<><span className="transport-summary-show">Ver restricciones</span><span className="transport-summary-hide">Ocultar restricciones</span></>}>
      <h4>Restricciones alimentarias indicadas</h4>
      <div className="outings-scroll" tabIndex={0} role="region" aria-label="Detalle de restricciones alimentarias">
        <table data-navigation-list="food" className="outings-table coordination-compact-table compact-food"><thead><tr>
          <th scope="col">Persona voluntaria</th><th scope="col">Restricciones alimentarias</th>
        </tr></thead><tbody>{restrictions.map(entry => <tr key={entry.id} id={`alimentacion-${entry.id}`}>
          <th scope="row">{canViewProfile && entry.volunteer_id
            ? <ContextDetailLink anchor={`alimentacion-${entry.id}`} href={`/coordinacion/registro/${entry.volunteer_id}`}>{entry.volunteer}</ContextDetailLink>
            : entry.volunteer || 'Ficha pendiente de conciliar'}</th>
          <td data-label="Restricciones alimentarias" className="copy">{entry.food}</td>
        </tr>)}</tbody></table>
      </div>
    </MobileDisclosure>
  </section>;
}
