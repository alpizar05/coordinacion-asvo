'use client';

import Link from 'next/link';
import { useState } from 'react';

export type OutingRow = {
  id: string; title: string; location: string; unit: string;
  starts: string; ends: string; status: string; listed: boolean;
};

const columns = [
  ['title','Convocatoria'], ['location','Lugar'], ['unit','Unidad'], ['starts','Inicio'],
  ['ends','Fin'], ['status','Estado'], ['listed','Visibilidad'],
] as const;

type Column = typeof columns[number][0];
const collator = new Intl.Collator('es-CR', { sensitivity: 'base', numeric: true });
const visibility = (listed: boolean) => listed ? 'Pública' : 'Privada por enlace';
const date = (value: string) => value.split('-').reverse().join('/');
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function OutingsTable({ outings }: { outings: OutingRow[] }) {
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState('');
  const [status, setStatus] = useState('abierta');
  const [access, setAccess] = useState('');
  const [sort, setSort] = useState<{ column: Column; ascending: boolean }>({ column: 'starts', ascending: false });
  const units = [...new Set(outings.map(row => row.unit))].sort(collator.compare);
  const statuses = [...new Set(['abierta', ...outings.map(row => row.status)])].sort(collator.compare);
  const search = normalize(query.trim());
  const rows = outings.filter(row =>
    (!unit || row.unit === unit) &&
    (!status || row.status === status) &&
    (!access || visibility(row.listed) === access) &&
    normalize(`${row.title} ${row.location}`).includes(search)
  ).sort((a,b) => {
    const key = sort.column;
    const result = key === 'listed'
      ? collator.compare(visibility(a.listed),visibility(b.listed))
      : collator.compare(a[key],b[key]);
    return sort.ascending ? result : -result;
  });

  return <>
    <div className="outings-filters">
      <label>Buscar<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Título o lugar" /></label>
      <label>Unidad<select value={unit} onChange={event => setUnit(event.target.value)}>
        <option value="">Todas</option>{units.map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Estado<select value={status} onChange={event => setStatus(event.target.value)}>
        <option value="">Todos</option>{statuses.map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Visibilidad<select value={access} onChange={event => setAccess(event.target.value)}>
        <option value="">Todas</option><option>Pública</option><option>Privada por enlace</option>
      </select></label>
    </div>
    <p role="status">{rows.length} de {outings.length} convocatorias</p>
    <div className="outings-scroll" tabIndex={0} role="region" aria-label="Tabla de convocatorias">
      <table className="outings-table">
        <thead><tr>{columns.map(([column,label]) => {
          const active = sort.column === column;
          return <th key={column} scope="col" aria-sort={active ? sort.ascending ? 'ascending' : 'descending' : undefined}>
            <button type="button" onClick={() => setSort(current => ({
              column, ascending: current.column === column ? !current.ascending : true,
            }))}>{label} <span aria-hidden="true">{active ? sort.ascending ? '↑' : '↓' : '↕'}</span></button>
          </th>;
        })}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <th scope="row"><Link href={`/coordinacion/salidas/${row.id}`}>{row.title}</Link></th>
          <td>{row.location}</td><td>{row.unit}</td><td className="table-date">{date(row.starts)}</td><td className="table-date">{date(row.ends)}</td>
          <td><span className="pill" data-status={row.status}>{row.status}</span></td><td>{visibility(row.listed)}</td>
        </tr>)}
        {!rows.length && <tr><td colSpan={columns.length}>{outings.length ? 'Ninguna convocatoria coincide con los filtros.' : 'Todavía no hay convocatorias.'}</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
