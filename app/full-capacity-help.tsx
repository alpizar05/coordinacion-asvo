'use client';

import { useEffect, useId, useRef, useState } from 'react';

export function FullCapacityHelp() {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  return <div className="full-capacity-help" ref={root}
    onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        setOpen(false);
        event.stopPropagation();
      }
    }}>
    <button type="button" aria-label="Información sobre la lista de espera" aria-describedby={open ? id : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={() => setOpen(true)}>ⓘ</button>
    {open && <span className="capacity-tooltip" role="tooltip" id={id}>
      Podés enviar tu inscripción y quedar en lista de espera. Si se libera un cupo, te lo asignaremos por orden de recepción y te avisaremos por correo.
    </span>}
  </div>;
}
