'use client';

import { useId, useRef, useSyncExternalStore, type ReactNode } from 'react';

const subscribe = (callback: () => void) => {
  const media = window.matchMedia('(max-width: 700px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const snapshot = () => window.matchMedia('(max-width: 700px)').matches;

export function MobileDisclosure({ title, children, className, desktopSummary, closeOnSubmit = false }: {
  title: string; children: ReactNode; className?: string; desktopSummary?: ReactNode; closeOnSubmit?: boolean;
}) {
  const mobile = useSyncExternalStore(subscribe, snapshot, () => false);
  const modal = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  if (!mobile) return <details className={className}><summary>{desktopSummary ?? title}</summary>{children}</details>;
  return <div className="mobile-disclosure">
    <button ref={trigger} type="button" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>{title}</button>
    <dialog ref={modal} className="table-filter-modal coordination-section-modal" aria-labelledby={id}
      onClose={() => trigger.current?.focus()}
      onSubmitCapture={() => { if (closeOnSubmit) modal.current?.close(); }}
      onClick={event => { if (event.target === event.currentTarget) modal.current?.close(); }}>
      <header className="table-filter-heading"><h2 id={id}>{title}</h2>
        <button type="button" className="table-filter-close" aria-label={`Cerrar ${title.toLocaleLowerCase('es')}`}
          onClick={() => modal.current?.close()}>×</button>
      </header>
      <div className="coordination-section-modal-content">{children}</div>
    </dialog>
  </div>;
}
