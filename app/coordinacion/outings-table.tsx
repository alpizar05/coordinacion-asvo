'use client';

import { compactParticipationDates } from '../../lib/participation-dates';


import Link from 'next/link';
import { ActiveFilters } from './active-filters';
import { TableFilters } from './table-filters';
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
    <div className="coordination-table-toolbar"><TableFilters title="Filtrar convocatorias" active={!!(query || unit || status || access)}><div className="outings-filters">
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
    <label className="coordination-mobile-sort">Ordenar por
      <select value={`${sort.column}:${sort.ascending ? 'asc' : 'desc'}`} onChange={event => {
        const [column,direction] = event.target.value.split(':');
        setSort({ column: column as Column, ascending: direction === 'asc' });
      }}>
        {columns.flatMap(([column,label]) => [
          <option key={`${column}:asc`} value={`${column}:asc`}>{label} · ascendente</option>,
          <option key={`${column}:desc`} value={`${column}:desc`}>{label} · descendente</option>,
        ])}
      </select>
    </label></TableFilters>
    <p role="status">{rows.length} de {outings.length} convocatorias</p></div>
    <ActiveFilters label="Filtros activos de convocatorias" chips={[
      ...(query.trim() ? [{key:'search',label:`Búsqueda: ${query.trim()}`,description:'Búsqueda',remove:() => setQuery('')}] : []),
      ...(unit ? [{key:'unit',label:unit,description:'Unidad',remove:() => setUnit('')}] : []),
      ...(status ? [{key:'status',label:status,description:'Estado',remove:() => setStatus('')}] : []),
      ...(access ? [{key:'access',label:access,description:'Visibilidad',remove:() => setAccess('')}] : []),
    ]} reset={query || unit || access || status !== 'abierta' ? () => {
      setQuery(''); setUnit(''); setAccess(''); setStatus('abierta');
    } : undefined} />
    <div className="outings-scroll" tabIndex={0} role="region" aria-label="Tabla de convocatorias">
      <table className="outings-table coordination-compact-table compact-outings">
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
          <td data-label="Lugar" className={row.location === row.title ? 'compact-duplicate-location' : undefined}>{row.location}</td><td data-label="Unidad">{row.unit}</td><td data-label="Inicio" className="table-date"><span className="compact-desktop-only">{date(row.starts)}</span><span className="compact-mobile-only">{compactParticipationDates(row.starts,row.ends)}</span></td><td data-label="Fin" className="table-date">{date(row.ends)}</td>
          <td data-label="Estado"><span className="pill" data-status={row.status}>{row.status}</span></td><td data-label="Visibilidad">{visibility(row.listed)}</td>
        </tr>)}
        {!rows.length && <tr><td colSpan={columns.length}>{outings.length ? 'Ninguna convocatoria coincide con los filtros.' : 'Todavía no hay convocatorias.'}</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
