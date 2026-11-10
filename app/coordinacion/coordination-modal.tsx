'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export function CoordinationModal({ open, onClose, title, children, footer, dirty = false, pending = false, wide = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
  dirty?: boolean; pending?: boolean; wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [discard, setDiscard] = useState(false);
  const discardNotice = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      setDiscard(false);
      if (!dialog.current?.open) dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close();
      previousFocus.current?.focus();
    }
    return () => { if (dialog.current?.open) dialog.current.close(); };
  }, [open]);
  useEffect(() => { if (discard) discardNotice.current?.focus(); }, [discard]);
  const requestClose = () => {
    if (pending) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  return <dialog ref={dialog} className={`coordination-modal${wide ? ' coordination-modal-wide' : ''}`} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); requestClose(); }}
    onClick={event => { if (event.target === event.currentTarget) requestClose(); }}>
    <header className="coordination-modal-heading"><h2 id={id}>{title}</h2>
      <button type="button" className="coordination-modal-close" aria-label="Cerrar" disabled={pending} onClick={requestClose}>×</button>
    </header>
    {discard && <div ref={discardNotice} tabIndex={-1} className="coordination-modal-discard" role="alert">
      <p>Tenés cambios sin guardar. ¿Querés descartarlos?</p>
      <div className="actions"><button type="button" onClick={() => setDiscard(false)}>Seguir editando</button>
        <button type="button" className="coord-button-danger" onClick={onClose}>Descartar cambios</button></div>
    </div>}
    <div className="coordination-modal-body">{children}</div>
    <footer className="coordination-modal-footer"><button type="button" disabled={pending} onClick={requestClose}>Cancelar</button>{footer}</footer>
  </dialog>;
}
