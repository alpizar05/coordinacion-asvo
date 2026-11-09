'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { statuses } from '../../registration-statuses';

export function OutingRegistrationFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  return <label>Estado de inscripción
    <select value={value} onChange={event => {
      const query = new URLSearchParams();
      if (current.get('editar') === '1') query.set('editar', '1');
      if (event.target.value !== 'todos') query.set('estado', event.target.value);
      const search = query.size ? `?${query}` : '';
      router.replace(`${pathname}${search}#inscripciones`, { scroll: false });
    }}>
      <option value="todos">Todos</option>
      {statuses.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
    </select>
  </label>;
}
