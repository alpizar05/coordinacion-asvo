'use client';
import { preserveCurrentNavigation, navigationSaved } from './navigation-position';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { checkedFormResult, fieldErrorMessages, type FieldErrors, type FormResult } from '../../lib/form-result';
import { FormFeedbackProvider, FormErrorSummary, useFormFeedback } from '../form-feedback/form-feedback';
import { StatusRibbon } from '../status-ribbon';
import { CoordinationModal } from './coordination-modal';

export type ActionModalProps = {
  validate?: (data: FormData) => FieldErrors;
  fieldLabels?: Record<string,string>;
  fieldDependencies?: Record<string,string[]>;
  revealField?: (name: string) => void | Promise<void>;
  successMessage?: string;
  open?: boolean; onClose?: () => void;
  title: string; action: (form: FormData) => Promise<FormResult>; children: ReactNode; wide?: boolean; id?: string; saveLabel?: string;
};

export function ActionModal({ title, action, children, wide = false, id, saveLabel = 'Guardar cambios', successMessage = 'Cambios guardados.', validate, fieldLabels, fieldDependencies, revealField, open: controlledOpen, onClose }: ActionModalProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); if (!value) onClose?.(); };
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmation,setConfirmation] = useState({id:0,message:''});
  const form = useRef<HTMLFormElement>(null),inFlight=useRef(false);
  const feedback = useFormFeedback({form,validate,labels:fieldLabels,dependencies:fieldDependencies,revealField});
  const formId = useId();
  const router = useRouter();
  useEffect(() => {
    if (controlledOpen) { form.current?.reset(); feedback.reset(); setDirty(false); }
  },[controlledOpen]);
  return <div id={id} className={controlledOpen === undefined ? "mobile-disclosure" : undefined}>
    <StatusRibbon key={confirmation.id} message={confirmation.message} />
    {controlledOpen === undefined && <button type="button" aria-haspopup="dialog" onClick={() => {
      form.current?.reset(); feedback.reset(); setDirty(false); setOpen(true);
    }}>{title}</button>}
    <CoordinationModal open={open} onClose={() => setOpen(false)} title={title} dirty={dirty} pending={pending} wide={wide}
      footer={<button type="submit" form={formId} disabled={pending} className="coord-button-primary">{pending ? 'Guardando…' : saveLabel}</button>}>
      <FormFeedbackProvider feedback={feedback}><form ref={form} id={formId} noValidate={!!validate} onChange={event => { setDirty(true); const target=event.target; if(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) feedback.changed(target.name); }} onSubmit={async event => {
        event.preventDefault();
        if (inFlight.current) return;
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        const clientErrors = validate?.(data) || {};
        if (Object.values(clientErrors).some(value=>fieldErrorMessages(value).length)) { feedback.showErrors(clientErrors); return; }
        inFlight.current=true;setPending(true);
        try {
          const result = checkedFormResult(await action(data));
          if (result.saved !== true) {
            feedback.showErrors(result?.fieldErrors,result?.error || (Object.values(result?.fieldErrors || {}).some(value=>fieldErrorMessages(value).length) ? '' : 'No se pudo guardar. Revisá los datos e intentá de nuevo.'));
          } else {
            navigationSaved();setDirty(false); setOpen(false);
            if (result.destination) router.push(preserveCurrentNavigation(result.destination),{scroll:false});
            else { setConfirmation(previous=>({id:previous.id+1,message:successMessage})); router.refresh(); }
          }
        } catch {
          feedback.showErrors({},'No se pudo guardar. Tus datos se conservan para reintentar.');
        } finally { inFlight.current=false;setPending(false); }
      }}>
        <FormErrorSummary />
        <fieldset disabled={pending} className="coordination-modal-form-fields">{children}</fieldset>
        {pending && <p role="status">Guardando…</p>}
      </form></FormFeedbackProvider>
    </CoordinationModal>
  </div>;
}
