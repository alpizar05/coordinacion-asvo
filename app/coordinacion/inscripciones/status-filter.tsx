'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TableFilters } from '../table-filters';

export function StatusFilter({ value, statuses, units, unit, from, to }: {
  value: string;
  statuses: readonly (readonly [string, string])[];
  units: string[];
  unit: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [selection,setSelection] = useState({estado:value,unidad:unit,desde:from,hasta:to});
  useEffect(()=>setSelection({estado:value,unidad:unit,desde:from,hasta:to}),[value,unit,from,to]);

  function update(key: keyof typeof selection, value: string) {
    const next = {...selection,[key]:value};
    setSelection(next);
    const query = new URLSearchParams();
    for (const [name,field] of Object.entries(next)) if (field) query.set(name,field);
    router.replace(`/coordinacion/inscripciones?${query}`,{scroll:false});
  }
  return <TableFilters title="Filtrar inscripciones" active={!!(value !== 'todos' || unit || from || to)}><form className="outings-filters" onSubmit={event => event.preventDefault()}>
    <label>Estado<select name="estado" value={selection.estado} onChange={event=>update('estado',event.target.value)}>
      <option value="todos">Todos</option>
      {statuses.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
    </select></label>
    <label>Unidad<select name="unidad" value={selection.unidad} onChange={event=>update('unidad',event.target.value)}>
      <option value="">Todas</option>
      {units.map(name => <option key={name}>{name}</option>)}
    </select></label>
    <label>Desde<input type="date" name="desde" value={selection.desde} onChange={event=>update('desde',event.target.value)} /></label>
    <label>Hasta<input type="date" name="hasta" value={selection.hasta} onChange={event=>update('hasta',event.target.value)} /></label>
  </form></TableFilters>;
}
