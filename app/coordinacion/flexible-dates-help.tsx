'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export function FlexibleDatesHelp({ children }: { children: ReactNode }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown',dismiss);
    return () => document.removeEventListener('pointerdown',dismiss);
  }, [open]);
  return <div className="flexible-dates-help" ref={root} onKeyDown={event => {
    if (event.key === 'Escape') { setOpen(false); event.stopPropagation(); }
  }}>
    {children}
    <span onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="flexible-dates-help-trigger tooltip-trigger" aria-label="Información sobre fechas flexibles"
        aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}>ⓘ</button>
      {open && <span id={id} role="tooltip" className="flexible-dates-tooltip">
        Las personas pueden solicitar menos días o proponer llegar antes o salir después. Coordinación confirma las fechas solicitadas.
      </span>}
    </span>
  </div>;
}
