'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { createOutingCollection } from '../../../staff-actions';
import type { OutingRow } from '../../outings-table';

function formatDate(value: string) {
  return value.split('-').reverse().join('/');
}

export function CollectionForm({ outings }: { outings: OutingRow[] }) {
  const [error, action, pending] = useActionState(createOutingCollection, '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const terms = search.trim().toLocaleLowerCase('es').split(/\s+/);
  const matches = outings.filter(outing => {
    const text = [outing.title, outing.location, outing.unit, outing.starts, outing.ends,
      formatDate(outing.starts), formatDate(outing.ends)].join(' ').toLocaleLowerCase('es');
    return terms.every(term => text.includes(term));
  });

  return <form className="card" action={action}>
    <label>Nombre de la convocatoria en serie<input name="name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
    <label>Descripción (opcional)<textarea name="description" maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
    <label>Buscar por nombre, lugar, unidad o fecha
      <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
    </label>
    <p role="status">{selected.length} {selected.length === 1 ? 'salida seleccionada' : 'salidas seleccionadas'}</p>
    {selected.map(id => <input key={id} type="hidden" name="outing" value={id} />)}
    {matches.length ? <div className="outings-scroll" tabIndex={0} role="region" aria-label="Salidas disponibles para agrupar">
      <table className="outings-table">
        <thead><tr><th scope="col">Incluir</th><th scope="col">Salida</th><th scope="col">Unidad</th><th scope="col">Fechas</th><th scope="col">Estado</th></tr></thead>
        <tbody>{matches.map(outing => <tr key={outing.id}>
          <td><input type="checkbox" aria-labelledby={`outing-${outing.id} dates-${outing.id}`}
            checked={selected.includes(outing.id)} onChange={event => {
              const checked = event.currentTarget.checked;
              setSelected(current => checked ? [...current, outing.id] : current.filter(id => id !== outing.id));
            }} /></td>
          <th scope="row" id={`outing-${outing.id}`}>{outing.title} · {outing.location}</th>
          <td>{outing.unit}</td>
          <td id={`dates-${outing.id}`}>{formatDate(outing.starts)} al {formatDate(outing.ends)}</td>
          <td>{outing.status} · {outing.listed ? 'pública' : 'privada'}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p>No hay salidas que coincidan con la búsqueda.</p>}
    {error && <p role="alert" className="note">{error}</p>}
    <div className="actions">
      <button className="coord-button-primary" type="submit" disabled={pending || !selected.length}>{pending ? 'Guardando…' : 'Guardar y abrir vista pública'}</button>
      <Link href="/coordinacion#colecciones">Cancelar</Link>
    </div>
  </form>;
}
