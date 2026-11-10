'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CoordinationModal } from './coordination-modal';

export function ActionModal({ title, action, children, wide = false, id, saveLabel = 'Guardar cambios' }: {
  title: string; action: (form: FormData) => Promise<unknown>; children: ReactNode; wide?: boolean; id?: string; saveLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const formId = useId();
  const router = useRouter();
  return <div id={id} className="mobile-disclosure">
    <button type="button" aria-haspopup="dialog" onClick={() => {
      form.current?.reset(); setError(''); setDirty(false); setOpen(true);
    }}>{title}</button>
    <CoordinationModal open={open} onClose={() => setOpen(false)} title={title} dirty={dirty} pending={pending} wide={wide}
      footer={<button type="submit" form={formId} disabled={pending} className="coord-button-primary">{pending ? 'Guardando…' : saveLabel}</button>}>
      <form ref={form} id={formId} onChange={() => setDirty(true)} onSubmit={async event => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        setPending(true); setError('');
        try {
          const result = await action(data) as { error?: string; saved?: boolean; destination?: string } | undefined;
          if (result?.error || !result?.saved) {
            setError(result?.error || 'No se pudo guardar. Revisá los datos e intentá de nuevo.');
            setTimeout(() => errorRef.current?.focus(), 0);
          } else {
            setDirty(false); setOpen(false);
            if (result.destination) router.push(result.destination);
            else router.refresh();
          }
        } catch {
          setError('No se pudo guardar. Tus datos se conservan para reintentar.');
          setTimeout(() => errorRef.current?.focus(), 0);
        } finally { setPending(false); }
      }}>
        {error && <p ref={errorRef} tabIndex={-1} className="note" role="alert">{error}</p>}
        <fieldset disabled={pending} className="coordination-modal-form-fields">{children}</fieldset>
        {pending && <p role="status">Guardando…</p>}
      </form>
    </CoordinationModal>
  </div>;
}
