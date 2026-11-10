import Link from 'next/link';
import { displayDate } from '../../../lib/registration';
import { statusLabels } from '../registration-statuses';

export function ActiveRegistrationFilters({ status, unit, from, to }: {status:string;unit:string;from:string;to:string}) {
  const url = (remove: 'status'|'unit'|'dates') => {
    const query = new URLSearchParams({estado:remove === 'status' ? 'todos' : status});
    if (unit && remove !== 'unit') query.set('unidad',unit);
    if (from && remove !== 'dates') query.set('desde',from);
    if (to && remove !== 'dates') query.set('hasta',to);
    return `/coordinacion/inscripciones?${query}`;
  };
  const chips = [
    ...(status !== 'todos' ? [{ key:'status' as const,label:statusLabels.get(status) || status,description:'Estado' }] : []),
    ...(unit ? [{key:'unit' as const,label:unit,description:'Unidad'}] : []),
    ...(from || to ? [{key:'dates' as const,label:from && to ? `${displayDate(from)} – ${displayDate(to)}` : from ? `Desde ${displayDate(from)}` : `Hasta ${displayDate(to)}`,description:'Fechas'}] : []),
  ];
  const canReset = status !== 'revisión' || !!(unit || from || to);
  if (!chips.length && !canReset) return null;
  return <nav className="registration-active-filters" aria-label="Filtros activos de inscripciones">
    {chips.map(chip => <Link key={chip.key} href={url(chip.key)} scroll={false} className="active-filter-chip"
      aria-label={`Quitar filtro ${chip.description}: ${chip.label}`}><span className="active-filter-chip-content">{chip.label}<span aria-hidden="true">×</span></span></Link>)}
    {canReset && <Link href="/coordinacion/inscripciones?estado=revisi%C3%B3n" scroll={false} className="active-filter-reset">Restablecer</Link>}
  </nav>;
}
