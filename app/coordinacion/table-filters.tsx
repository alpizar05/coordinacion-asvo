'use client';

import { useEffect, useId, useRef, useSyncExternalStore, type RefObject, type ReactNode } from 'react';

const subscribe = (callback: () => void) => {
  const media = window.matchMedia('(max-width: 700px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const mobileSnapshot = () => window.matchMedia('(max-width: 700px)').matches;

export function TableFilters({ children, title = 'Filtros', active = false, revealRef }: {
  revealRef?:RefObject<(()=>void)|null>;
  children: ReactNode; title?: string; active?: boolean;
}) {
  const mobile = useSyncExternalStore(subscribe, mobileSnapshot, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(()=>{if(!revealRef)return;revealRef.current=()=>{if(mobile&&!dialog.current?.open)dialog.current?.showModal();};return()=>{revealRef.current=null;};},[mobile,revealRef]);
  if (!mobile) return <div className="table-filters-desktop">{children}</div>;
  return <div className="table-filters-mobile">
    <button ref={trigger} type="button" className="table-filter-trigger" aria-haspopup="dialog"
      aria-label={`${title}${active ? ' · filtros activos' : ''}`} onClick={() => dialog.current?.showModal()}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" />
        <circle cx="8" cy="5" r="2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      </svg>
      {active && <span className="table-filter-active" aria-hidden="true" />}
    </button>
    <dialog ref={dialog} className="table-filter-modal" aria-labelledby={id}
      onClose={() => trigger.current?.focus()} onClick={event => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}>
      <header className="table-filter-heading"><h2 id={id}>{title}</h2>
        <button type="button" className="table-filter-close" aria-label="Cerrar filtros" onClick={() => dialog.current?.close()}>×</button>
      </header>
      <div className="table-filter-fields">{children}</div>
      <footer><button type="button" className="coord-button-primary" onClick={() => dialog.current?.close()}>Ver resultados</button></footer>
    </dialog>
  </div>;
}
