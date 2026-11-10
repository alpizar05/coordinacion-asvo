'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActiveFilters } from '../../active-filters';
import { statuses, statusLabels } from '../../registration-statuses';
import { TableFilters } from '../../table-filters';

export function OutingRegistrationFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [chipSlot,setChipSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setChipSlot(document.getElementById('outing-registration-active-filters')); }, []);
  function update(status: string) {
    const query = new URLSearchParams(current.toString());
    if (status === 'todos') query.delete('estado');
    else query.set('estado',status);
    router.replace(`${pathname}${query.size ? `?${query}` : ''}#inscripciones`, { scroll: false });
  }
  return <><TableFilters title="Filtrar inscripciones" active={value !== 'todos'}><label>Estado de inscripción
    <select value={value} onChange={event => update(event.target.value)}>
      <option value="todos">Todos</option>
      {statuses.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
    </select>
  </label></TableFilters>
    {chipSlot && createPortal(<ActiveFilters label="Filtros activos de inscripciones de la salida" chips={value !== 'todos' ? [{
      key:'status',label:statusLabels.get(value) || value,description:'Estado',remove:() => update('todos'),
    }] : []} />,chipSlot)}
  </>;
}
