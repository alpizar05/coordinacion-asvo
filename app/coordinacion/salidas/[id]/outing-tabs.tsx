'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

const tabs = [
  { id: 'inscripciones', label: 'Inscripciones' },
  { id: 'logistica', label: 'Logística' },
  { id: 'informacion', label: 'Información' },
  { id: 'herramientas', label: 'Herramientas' },
] as const;
export type OutingTab = typeof tabs[number]['id'];
export function outingTab(value?: string): OutingTab {
  return tabs.find(tab => tab.id === value)?.id ?? 'inscripciones';
}

export function OutingTabs({ initial, panels }: { initial: OutingTab; panels: Record<OutingTab, ReactNode> }) {
  const prefix = useId();
  const root = useRef<HTMLDivElement>(null);
  const search = useSearchParams();
  const [active, setActive] = useState<OutingTab>(initial);
  useEffect(() => {
    function sync() {
      const url = new URL(window.location.href);
      const target = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
      const panel = target?.closest<HTMLElement>('[data-outing-tab]');
      const next = panel && root.current?.contains(panel) ? outingTab(panel.dataset.outingTab) : outingTab(url.searchParams.get('pestana') ?? initial);
      setActive(next);
      if (target && panel) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [initial, search]);

  function select(id: OutingTab, focus = false) {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set('pestana', id);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url.href);
    if (focus) document.getElementById(`${prefix}-tab-${id}`)?.focus();
  }

  return <div className="coordination-outing-tabs" ref={root}>
    <div className="outing-tab-list" role="tablist" aria-label="Contenido de la salida">
      {tabs.map((tab, index) => <button type="button" key={tab.id} role="tab" id={`${prefix}-tab-${tab.id}`}
        aria-controls={`${prefix}-panel-${tab.id}`} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1}
        onClick={() => select(tab.id)} onKeyDown={event => {
          let next = index;
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = tabs.length - 1;
          else return;
          event.preventDefault();
          select(tabs[next].id, true);
        }}>{tab.label}</button>)}
    </div>
    {tabs.map(tab => <div key={tab.id} role="tabpanel" id={`${prefix}-panel-${tab.id}`}
      aria-labelledby={`${prefix}-tab-${tab.id}`} data-outing-tab={tab.id} hidden={active !== tab.id} tabIndex={0}>
      {panels[tab.id]}
    </div>)}
  </div>;
}
