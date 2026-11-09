import Link from 'next/link';
import { registrationLogistics } from '../../lib/registration-logistics';

export function FoodSummary({ entries, canViewProfile }: {
  entries: { id: string; status: string; volunteer: string; volunteer_id: string | null; details: Record<string, unknown> | null }[];
  canViewProfile: boolean;
}) {
  const restrictions = entries.filter(entry => entry.status === 'confirmada')
    .map(entry => ({ ...entry, food: registrationLogistics(entry.details).food }))
    .filter(entry => entry.food);

  if (!restrictions.length) return <p className="muted food-summary-empty">Sin restricciones alimentarias indicadas entre las personas confirmadas.</p>;

  return <section className="transport-summary food-summary" aria-label="Resumen de alimentación">
    <h3>Alimentación · Personas confirmadas</h3>
    <div className="transport-summary-totals">
      <p><strong>{restrictions.length}</strong> {restrictions.length === 1 ? 'persona indicó' : 'personas indicaron'} restricciones alimentarias</p>
    </div>
    <details className="transport-summary-detail">
      <summary><span className="transport-summary-show">Ver restricciones</span><span className="transport-summary-hide">Ocultar restricciones</span></summary>
      <h4>Restricciones alimentarias indicadas</h4>
      <div className="outings-scroll" tabIndex={0} role="region" aria-label="Detalle de restricciones alimentarias">
        <table className="outings-table"><thead><tr>
          <th scope="col">Persona voluntaria</th><th scope="col">Restricciones alimentarias</th>
        </tr></thead><tbody>{restrictions.map(entry => <tr key={entry.id}>
          <th scope="row">{canViewProfile && entry.volunteer_id
            ? <Link href={`/coordinacion/registro/${entry.volunteer_id}`}>{entry.volunteer}</Link>
            : entry.volunteer || 'Ficha pendiente de conciliar'}</th>
          <td className="copy">{entry.food}</td>
        </tr>)}</tbody></table>
      </div>
    </details>
  </section>;
}
