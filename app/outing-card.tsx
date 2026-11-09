import { FullCapacityHelp } from './full-capacity-help';
import { CapacitySummary } from './capacity-summary';
import Link from 'next/link';
import type { listedOutings } from '../lib/catalog';
import { displayDate } from '../lib/registration';

export function OutingCard({ outing, periods = 1, collection }: {
  outing: Awaited<ReturnType<typeof listedOutings>>[number]; periods?: number; collection?: { href: string; title: string };
}) {
  const isSeries = !!collection || periods > 1;
  const available = Math.max(0, outing.capacity - outing.occupied);
  const capacityTone = available === 0 ? 'full' : available * 3 <= outing.capacity ? 'limited' : 'available';
  const href = collection?.href ?? (periods > 1 ? `/colecciones/${outing.request_id}` : `/convocatorias/${outing.id}`);
  const key = href.replaceAll('/', '-');
  const titleId = `outing-title${key}`;
  const detailId = `outing-details${key}`;

  const footerId = `outing-footer${key}`;

  return <div className="outing-card-shell">
  <Link className={`card outing-card${isSeries ? ' outing-card-series' : ''}`} href={href}
    aria-labelledby={titleId} aria-describedby={`${detailId} ${footerId}`}>
    {outing.photo_id && <img className="outing-cover" src={`/api/fotos/${outing.photo_id}?v=tarjeta`}
      alt={outing.alt ?? ''} loading="lazy" />}
    <h3 id={titleId}>{collection?.title ?? (periods > 1 ? outing.general_title ?? outing.title : outing.title)}</h3>
    <div id={detailId} className="outing-card-details">
      <p>{outing.location}</p>
      <p><strong>{isSeries ? 'Próxima fecha disponible' : 'Fecha disponible'}</strong><br />
        <time dateTime={outing.starts}>{displayDate(outing.starts)}</time>
        {outing.starts !== outing.ends && <> al <time dateTime={outing.ends}>{displayDate(outing.ends)}</time></>}
      </p>
      <div className="outing-card-tags">
        <span className="pill">{outing.unit}</span>
        {outing.flexible && <span className="pill">Fechas flexibles</span>}
      </div>
    </div>
    <div className={`outing-card-footer${isSeries ? '' : ` capacity-${capacityTone}`}`} id={footerId}>
      {isSeries ? <>
        <span>Serie de salidas</span>
        <strong>Ver {periods} {periods === 1 ? 'fecha' : 'fechas'} <span aria-hidden="true">›</span></strong>
      </> : <CapacitySummary capacity={outing.capacity} occupied={outing.occupied} />}
    </div>
  </Link>
  {!isSeries && available === 0 && <FullCapacityHelp />}
  </div>;
}
