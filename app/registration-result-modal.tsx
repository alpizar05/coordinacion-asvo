'use client';

import { useEffect, useId, useRef } from 'react';

export function RegistrationResultModal({ title, paragraphs, greeting, success = false }: {
  title: string;
  paragraphs: string[];
  greeting?: string;
  success?: boolean;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const result = dialog.current;
    document.querySelector<HTMLDialogElement>('.registration-drawer dialog[open]')?.close();
    if (result && !result.open) result.showModal();
    return () => result?.close();
  }, []);

  return <dialog ref={dialog} className={`registration-result-modal${success ? ' registration-result-success' : ''}`}
    role={success ? 'dialog' : 'alertdialog'} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onClose={() => {
      const url = new URL(window.location.href);
      for (const key of ['recibido','estado','registroError','poliza','fechas','invitacionError','resultado']) url.searchParams.delete(key);
      window.history.replaceState(window.history.state,'',url.href);
      document.querySelector<HTMLButtonElement>('.registration-drawer .drawer-trigger')?.focus();
    }}>
    <h2 id={`${id}-title`}>{title}</h2>
    <div id={`${id}-description`}>{greeting && <p className="registration-result-greeting"><strong>{greeting}</strong></p>}{paragraphs.map((paragraph,index) => <p key={index}>{paragraph}</p>)}</div>
    <button type="button" autoFocus onClick={() => dialog.current?.close()}>Entendido</button>
  </dialog>;
}
