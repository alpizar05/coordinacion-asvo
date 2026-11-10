'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TableFilters } from '../table-filters';

export function VolunteerFilters({ query, unit, units }: { query: string; unit: string; units: string[] }) {
  const [search,setSearch] = useState(query);
  const [selectedUnit,setSelectedUnit] = useState(unit);
  const [pending,startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (document.activeElement !== input.current) setSearch(query);
    setSelectedUnit(unit);
  }, [query,unit]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function navigate(value: string, selected: string, delay = 0) {
    if (timer.current) clearTimeout(timer.current);
    const params = new URLSearchParams();
    if (value.trim()) params.set('buscar',value.trim());
    if (selected) params.set('unidad',selected);
    timer.current = setTimeout(() => startTransition(() => {
      router.replace(`/coordinacion/registro${params.size ? `?${params}` : ''}`, { scroll: false });
    }),delay);
  }
  return <TableFilters title="Buscar personas voluntarias" active={!!(search || selectedUnit)}>
    <div className="outings-filters" aria-busy={pending}>
      <label>Buscar persona<input ref={input} type="search" maxLength={120} value={search}
        placeholder="Nombre, identificación o correo" onChange={event => {
          setSearch(event.target.value); navigate(event.target.value,selectedUnit,300);
        }} /></label>
      <label>Unidad<select value={selectedUnit} onChange={event => {
        setSelectedUnit(event.target.value); navigate(search,event.target.value);
      }}><option value="">Todas</option>{units.map(name => <option key={name}>{name}</option>)}</select></label>
      {(search || selectedUnit) && <button type="button" onClick={() => {
        setSearch(''); setSelectedUnit(''); navigate('','');
      }}>Restablecer</button>}
      {pending && <span role="status">Buscando…</span>}
    </div>
  </TableFilters>;
}
