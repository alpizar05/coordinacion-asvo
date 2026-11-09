'use client';

import { useId, useRef, type ReactNode } from 'react';

export function Drawer({ label, title, className, children, closeOnLink }: {
  label: string;
  title: string;
  className?: string;
  children: ReactNode;
  closeOnLink?: boolean;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);

  return <div className={className}>
    <button type="button" className="drawer-trigger" aria-haspopup="dialog"
      onClick={() => dialog.current?.showModal()}>{label}</button>
    <dialog ref={dialog} className="drawer" aria-labelledby={id}
      onClick={event => {
        const target = event.target;
        if (target === event.currentTarget || (closeOnLink && target instanceof Element && target.closest('a'))) {
          dialog.current?.close();
        }
      }}>
      <div className="drawer-inner">
        <header className="drawer-heading">
          <h2 id={id}>{title}</h2>
          <button type="button" className="drawer-close" aria-label="Cerrar panel" onClick={() => dialog.current?.close()}><span>Cerrar</span><span className="drawer-close-icon" aria-hidden="true">×</span></button>
        </header>
        {children}
      </div>
    </dialog>
  </div>;
}
