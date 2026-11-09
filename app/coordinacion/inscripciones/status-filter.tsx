'use client';

import { useRouter } from 'next/navigation';

export function StatusFilter({ value, statuses, units, unit, from, to }: {
  value: string;
  statuses: readonly (readonly [string, string])[];
  units: string[];
  unit: string;
  from: string;
  to: string;
}) {
  const router = useRouter();

  return <form className="outings-filters" onSubmit={event => event.preventDefault()} onChange={event => {
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const [name, field] of data) {
      if (typeof field === 'string' && field) query.set(name, field);
    }
    router.replace(`/coordinacion/inscripciones?${query}`, { scroll: false });
  }}>
    <label>Estado<select name="estado" defaultValue={value}>
      <option value="todos">Todos</option>
      {statuses.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
    </select></label>
    <label>Unidad<select name="unidad" defaultValue={unit}>
      <option value="">Todas</option>
      {units.map(name => <option key={name}>{name}</option>)}
    </select></label>
    <label>Desde<input type="date" name="desde" defaultValue={from} /></label>
    <label>Hasta<input type="date" name="hasta" defaultValue={to} /></label>
  </form>;
}
