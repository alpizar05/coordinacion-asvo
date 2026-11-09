'use client';

import { StatusRibbon } from '../status-ribbon';

import Link from 'next/link';
import { RowActionPanel } from './row-action-panel';
import { useState } from 'react';

export type CollectionRow = {
  id: string;
  name: string;
  kind: 'automaticas' | 'manuales';
  outings: number;
  public_outings: number;
  next_start: string | null;
};

const labels = { automaticas: 'Automática', manuales: 'Manual' };

export function CollectionsTable({ collections }: { collections: CollectionRow[] }) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [availability, setAvailability] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
  const query = normalize(search.trim());
  const rows = collections.filter(row => normalize(row.name).includes(query) &&
    (!kind || row.kind === kind) &&
    (!availability || (availability === 'public' ? row.public_outings > 0 : row.public_outings === 0)))
    .sort((a, b) => (a.next_start ?? '9999-12-31').localeCompare(b.next_start ?? '9999-12-31')
      || a.name.localeCompare(b.name, 'es'));

  return <>
    <div className="outings-filters">
      <label>Buscar por nombre<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>Tipo<select value={kind} onChange={event => setKind(event.target.value)}>
        <option value="">Todos</option><option value="automaticas">Automáticas</option><option value="manuales">Manuales</option>
      </select></label>
      <label>Disponibilidad pública<select value={availability} onChange={event => setAvailability(event.target.value)}>
        <option value="">Todas</option><option value="public">Con salidas en el catálogo</option><option value="closed">Sin salidas en el catálogo</option>
      </select></label>
    </div>
    <p role="status">{rows.length} de {collections.length} convocatorias en serie</p>
    <StatusRibbon message={copyStatus} onExpire={setCopyStatus} />
    {rows.length ? <table className="outings-table collections-table" aria-label="Convocatorias en serie">
      <thead><tr><th scope="col">Convocatoria en serie</th><th scope="col">Tipo</th><th scope="col">Próximo inicio</th><th scope="col">Salidas</th><th scope="col">Acciones</th></tr></thead>
      <tbody>{rows.map(row => {
        const publicPath = row.kind === 'automaticas' ? `/colecciones/${row.id}` : `/colecciones/manuales/${row.id}`;
        return <tr key={`${row.kind}-${row.id}`}>
          <th className="collection-name" scope="row"><Link href={`/coordinacion/colecciones/${row.kind}/${row.id}`}>{row.name}</Link></th>
          <td className="collection-kind"><span className="pill">{labels[row.kind]}</span></td>
          <td className="collection-next">{row.next_start
            ? <time dateTime={row.next_start}>{row.next_start.split('-').reverse().join('/')}</time>
            : 'Sin fecha pública'}</td>
          <td className="collection-count">{row.public_outings} de {row.outings} en el catálogo</td>
          <td className="collection-actions">
            {row.public_outings > 0 && <RowActionPanel title="Acciones de la convocatoria en serie" subtitle={row.name}
              triggerLabel={`Gestionar convocatoria en serie ${row.name}`}>
              {close => <ul className="registration-sheet-actions collection-action-links">
                <li><Link href={publicPath} onClick={close}>Ver serie pública</Link></li>
                <li><button type="button" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).href);
                    setCopyStatus(`Enlace de ${row.name} copiado.`);
                  } catch {
                    setCopyStatus('Abrí la serie pública y copiá el enlace desde la barra de direcciones.');
                  }
                  close();
                }}>Copiar enlace</button></li>
              </ul>}
            </RowActionPanel>}
          </td>
        </tr>;
      })}</tbody>
    </table> : <p>{collections.length ? 'No hay convocatorias en serie que coincidan con los filtros.' : 'Todavía no hay convocatorias en serie.'}</p>}
  </>;
}
