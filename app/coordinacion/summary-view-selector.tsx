'use client';

import { useId, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Option = { key: string; label: string; count: number; href: string };
export function SummaryViewSelector({ options, selected }: { options: Option[]; selected: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const router = useRouter();
  const current = options.find(option => option.key === selected) || options[0];
  return <>
    <nav className="summary-tabs summary-view-desktop" aria-label="Pendientes de Coordinación">
      {options.map(option => <Link key={option.key} href={option.href} scroll={false} aria-current={selected === option.key ? 'page' : undefined}>
        {option.label} <span>{option.count}</span>
      </Link>)}
    </nav>
    <div className="summary-view-mobile">
      <button ref={trigger} type="button" className="summary-view-trigger" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <span className="summary-view-label">Ver:</span><span className="summary-view-current">{current.label}</span>
        <span className="summary-view-count">{current.count}</span><span aria-hidden="true">⌄</span>
      </button>
      <dialog ref={dialog} className="coordination-modal summary-view-modal" aria-labelledby={id}
        onClose={() => trigger.current?.focus()} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <header className="coordination-modal-heading"><h2 id={id}>Ver pendientes</h2>
          <button type="button" className="coordination-modal-close" aria-label="Cerrar opciones de vista" onClick={() => dialog.current?.close()}>×</button>
        </header>
        <ul className="summary-view-options">{options.map(option => <li key={option.key}>
          <button type="button" aria-pressed={selected === option.key} onClick={() => {
            dialog.current?.close();
            if (selected !== option.key) router.replace(option.href,{scroll:false});
          }}><span className="summary-view-check" aria-hidden="true">{selected === option.key ? '✓' : ''}</span>
            <span>{option.label}</span><span className="summary-view-count">{option.count}</span></button>
        </li>)}</ul>
      </dialog>
    </div>
  </>;
}
