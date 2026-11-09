'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function RowActionPanel({ title, subtitle, triggerLabel, openOnError, managed, onClose, children, expanded = false }: {
  title: string;
  expanded?: boolean;
  subtitle?: string;
  triggerLabel?: string;
  openOnError?: string;
  managed?: boolean;
  onClose?: () => void;
  children: (close: () => void) => ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);

  function positionPanel(dialog: HTMLDialogElement, button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    const above = rect.top;
    const below = window.innerHeight - rect.bottom;
    const openAbove = below < 300 && above > below;
    dialog.style.setProperty('--registration-menu-right', `${Math.max(8, window.innerWidth - rect.right)}px`);
    dialog.style.setProperty('--registration-menu-top', openAbove ? 'auto' : `${rect.bottom + 4}px`);
    dialog.style.setProperty('--registration-menu-bottom', openAbove ? `${window.innerHeight - rect.top + 4}px` : 'auto');
    dialog.style.setProperty('--registration-menu-space', `${Math.max(0, (openAbove ? above : below) - 12)}px`);
  }

  useEffect(() => {
    const dialog = panel.current;
    const button = trigger.current;
    if (!dialog || !button) return;
    if (managed) dialog.close();
    else if (openOnError && !dialog.open) {
      positionPanel(dialog, button);
      dialog.showModal();
    }

    const reposition = () => {
      if (dialog.open) positionPanel(dialog, button);
    };
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [openOnError, managed]);

  return <>
    <button ref={trigger} className="registration-manage-trigger" type="button" aria-haspopup="dialog"
      onClick={event => {
        const dialog = panel.current;
        if (!dialog) return;
        positionPanel(dialog, event.currentTarget);
        dialog.showModal();
      }} aria-label={triggerLabel}>Gestionar <span aria-hidden="true">⌄</span></button>
    <dialog className={`drawer registration-sheet${expanded ? ' registration-detail-view' : ''}`} ref={panel} aria-labelledby={id}
      onClose={onClose} onClick={event => {
        if (event.target === event.currentTarget) panel.current?.close();
      }}>
      <div className="registration-sheet-content">
        <header className="drawer-heading">
          <div><h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="registration-sheet-close" type="button" aria-label="Cerrar panel"
            onClick={() => panel.current?.close()}>×</button>
        </header>
        {children(() => panel.current?.close())}
      </div>
    </dialog>
  </>;
}
