'use client';

import { ContextDetailLink, NavigationResults, useTableCriteria } from './navigation-context';
import { StatusRibbon } from '../status-ribbon';

import Link from 'next/link';
import { ActiveFilters } from './active-filters';
import { TableFilters } from './table-filters';
import { compactParticipationDates } from '../../lib/participation-dates';
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
  const criteria=useTableCriteria();
  const search=criteria.get('serieBuscar'),kind=criteria.get('serieTipo'),availability=criteria.get('serieDisponibilidad');
  const setSearch=(value:string)=>criteria.set({serieBuscar:value}),setKind=(value:string)=>criteria.set({serieTipo:value}),setAvailability=(value:string)=>criteria.set({serieDisponibilidad:value});
  const [copyStatus, setCopyStatus] = useState('');
  const [copyError,setCopyError] = useState('');
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
  const query = normalize(search.trim());
  const rows = collections.filter(row => normalize(row.name).includes(query) &&
    (!kind || row.kind === kind) &&
    (!availability || (availability === 'public' ? row.public_outings > 0 : row.public_outings === 0)))
    .sort((a, b) => (a.next_start ?? '9999-12-31').localeCompare(b.next_start ?? '9999-12-31')
      || a.name.localeCompare(b.name, 'es'));

  return <><NavigationResults revision={collections}/>
    <div className="coordination-table-toolbar"><TableFilters title="Filtrar convocatorias en serie" active={!!(search || kind || availability)}><div className="outings-filters">
      <label>Buscar por nombre<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>Tipo<select value={kind} onChange={event => setKind(event.target.value)}>
        <option value="">Todos</option><option value="automaticas">Automáticas</option><option value="manuales">Manuales</option>
      </select></label>
      <label>Disponibilidad pública<select value={availability} onChange={event => setAvailability(event.target.value)}>
        <option value="">Todas</option><option value="public">Con salidas en el catálogo</option><option value="closed">Sin salidas en el catálogo</option>
      </select></label>
    </div></TableFilters>
    <p role="status">{rows.length} de {collections.length} convocatorias en serie</p></div>
    <ActiveFilters label="Filtros activos de convocatorias en serie" chips={[
      ...(search.trim() ? [{key:'search',label:`Búsqueda: ${search.trim()}`,description:'Búsqueda',remove:() => setSearch('')}] : []),
      ...(kind ? [{key:'kind',label:kind === 'automaticas' ? 'Automáticas' : 'Manuales',description:'Tipo',remove:() => setKind('')}] : []),
      ...(availability ? [{key:'availability',label:availability === 'public' ? 'Con salidas en el catálogo' : 'Sin salidas en el catálogo',description:'Disponibilidad pública',remove:() => setAvailability('')}] : []),
    ]} reset={search || kind || availability ? () => { setSearch(''); setKind(''); setAvailability(''); } : undefined} />
    {copyError && <p className="note" role="alert">{copyError}</p>}
    <StatusRibbon message={copyStatus} onExpire={setCopyStatus} />
    {rows.length ? <table className="outings-table collections-table coordination-compact-table compact-series" data-navigation-list="series" aria-label="Convocatorias en serie">
      <thead><tr><th scope="col">Convocatoria en serie</th><th scope="col">Tipo</th><th scope="col">Próximo inicio</th><th scope="col">Salidas</th><th scope="col">Acciones</th></tr></thead>
      <tbody>{rows.map(row => {
        const publicPath = row.kind === 'automaticas' ? `/colecciones/${row.id}` : `/colecciones/manuales/${row.id}`;
        return <tr id={`serie-${row.kind}-${row.id}`} key={`${row.kind}-${row.id}`}>
          <th className="collection-name" scope="row"><ContextDetailLink anchor={`serie-${row.kind}-${row.id}`} href={`/coordinacion/colecciones/${row.kind}/${row.id}`}>{row.name}</ContextDetailLink></th>
          <td data-label="Tipo" className="collection-kind"><span className="pill">{labels[row.kind]}</span></td>
          <td data-label="Próximo inicio" className="collection-next">{row.next_start
            ? <time dateTime={row.next_start}><span className="compact-desktop-only">{row.next_start.split('-').reverse().join('/')}</span><span className="compact-mobile-only">Próxima salida: {compactParticipationDates(row.next_start,row.next_start)}</span></time>
            : 'Sin fecha pública'}</td>
          <td data-label="Salidas" className="collection-count">{row.public_outings} de {row.outings} en el catálogo</td>
          <td data-label="Acciones" className="collection-actions">
            {row.public_outings > 0 && <RowActionPanel title="Acciones de la convocatoria en serie" subtitle={row.name}
              triggerLabel={`Gestionar convocatoria en serie ${row.name}`}>
              {close => <ul className="registration-sheet-actions collection-action-links">
                <li><Link href={publicPath} onClick={close}>Ver serie pública</Link></li>
                <li><button type="button" onClick={async () => {
                  try { setCopyError('');
                    await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).href);
                    setCopyStatus(`Enlace de ${row.name} copiado.`);
                  } catch {
                    setCopyError('No se pudo copiar. Abrí la serie pública y copiá el enlace desde la barra de direcciones.');
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
