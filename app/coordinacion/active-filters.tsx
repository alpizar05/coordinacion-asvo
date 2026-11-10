'use client';

export type ActiveFilter = { key: string; label: string; description: string; remove: () => void };

export function ActiveFilters({ chips, reset, label = 'Filtros activos' }: {
  chips: ActiveFilter[]; reset?: () => void; label?: string;
}) {
  if (!chips.length && !reset) return null;
  return <nav className="registration-active-filters" aria-label={label}>
    {chips.map(chip => <button key={chip.key} type="button" className="active-filter-chip"
      aria-label={`Quitar filtro ${chip.description}: ${chip.label}`} onClick={chip.remove}>
      <span className="active-filter-chip-content">{chip.label}<span aria-hidden="true">×</span></span>
    </button>)}
    {reset && <button type="button" className="active-filter-reset" onClick={reset}>Restablecer</button>}
  </nav>;
}
