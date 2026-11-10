'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TableFilters } from './table-filters';

export function SummaryFilters({ unit, days, tab, units }: { unit: string; days: number; tab: string; units: string[] }) {
  const router = useRouter();
  const [selectedUnit,setSelectedUnit] = useState(unit);
  const [selectedDays,setSelectedDays] = useState(days);
  const [pending,startTransition] = useTransition();
  useEffect(() => { setSelectedUnit(unit); setSelectedDays(days); },[unit,days]);
  function update(nextUnit: string, nextDays: number) {
    setSelectedUnit(nextUnit); setSelectedDays(nextDays);
    startTransition(() => router.replace(`/coordinacion?${new URLSearchParams({ unidad:nextUnit,dias:String(nextDays),pestana:tab })}`,{scroll:false}));
  }
  return <TableFilters title="Filtros de Resumen" active={!!selectedUnit || selectedDays !== 7}>
    <div className="outings-filters" aria-busy={pending}>
      <label>Unidad<select value={selectedUnit} onChange={event => update(event.target.value,selectedDays)}>
        <option value="">Todas mis unidades</option>{units.map(name => <option key={name}>{name}</option>)}
      </select></label>
      <label>Próximas salidas<select value={selectedDays} onChange={event => update(selectedUnit,Number(event.target.value))}>
        <option value="7">Próximos 7 días</option><option value="14">Próximos 14 días</option><option value="30">Próximos 30 días</option>
      </select></label>
      {(selectedUnit || selectedDays !== 7) && <button type="button" onClick={() => update('',7)}>Restablecer</button>}
      {pending && <span role="status">Actualizando…</span>}
    </div>
  </TableFilters>;
}
