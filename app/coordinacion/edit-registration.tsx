'use client';
import { navigationSaved } from './navigation-position';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoordinationModal } from './coordination-modal';
import { StatusRibbon } from '../status-ribbon';
import { StaffParticipationFields } from './staff-participation-fields';
import { FormFeedbackProvider,FormErrorSummary,useFormFeedback } from '../form-feedback/form-feedback';
import { validateStaffParticipation,staffRegistrationLabels } from '../../lib/staff-registration-validation';
import { fieldErrorMessages } from '../../lib/form-result';
import { loadEditableRegistration, saveEditedRegistration } from './edit-registration-actions';

type Data = NonNullable<Awaited<ReturnType<typeof loadEditableRegistration>>['data']>;
export function EditRegistration({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [data,setData] = useState<Data | null>(null), [error,setError] = useState(''), [success,setSuccess] = useState('');
  const [loading,setLoading] = useState(false), [pending,setPending] = useState(false), [dirty,setDirty] = useState(false);
  const [transport,setTransport] = useState(false);
  const formRef=useRef<HTMLFormElement>(null),inFlight=useRef(false);
  const feedback=useFormFeedback({form:formRef,validate:form=>data?validateStaffParticipation(form,{flexible:data.flexible,starts:data.firstDay,ends:data.lastDay}):{},labels:staffRegistrationLabels,dependencies:{starts:['ends'],ends:['starts'],transport:['rides']}});
  const formId=useId(),router=useRouter();
  useEffect(() => {
    if (!open) return;
    let active = true;
    setData(null); setError(''); feedback.reset(); setLoading(true); setDirty(false);
    loadEditableRegistration(id).then(result => {
      if (!active) return;
      if (result.data) { setData(result.data); setTransport(result.data.transport); }
      else setError(result.error || 'No se pudo cargar la inscripción.');
    }).catch(() => { if (active) setError('No se pudo cargar. Cerrá el modal e intentá de nuevo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[id,open]);
  return <>
    <StatusRibbon message={success} onExpire={setSuccess} />
    <CoordinationModal open={open} onClose={onClose} title="Editar inscripción" dirty={dirty} pending={pending}
      footer={<button type="submit" form={formId} disabled={pending || loading || !data} className="coord-button-primary">{pending ? 'Guardando…' : 'Guardar cambios'}</button>}>
      {loading && <p role="status">Cargando inscripción…</p>}
      {error && <p role="alert" className="note" tabIndex={-1}>{error}</p>}
      {open && data && <FormFeedbackProvider feedback={feedback}><form ref={formRef} id={formId} noValidate onChange={event=>{setDirty(true);const input=event.target;if(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)feedback.changed(input.name);}} onSubmit={async event => {
        event.preventDefault(); if(inFlight.current)return;
        const form = new FormData(event.currentTarget);
        const errors=validateStaffParticipation(form,{flexible:data.flexible,starts:data.firstDay,ends:data.lastDay});
        if(Object.values(errors).some(value=>fieldErrorMessages(value).length)){feedback.showErrors(errors);return;}
        inFlight.current=true;setPending(true);setError('');
        try {
          const result = await saveEditedRegistration(id,form);
          if (!result.saved) { feedback.showErrors(result.fieldErrors,result.error); }
          else { navigationSaved();setDirty(false); onClose(); setSuccess('Inscripción actualizada. Se notificará a la persona voluntaria por correo.'); router.refresh(); }
        } catch { feedback.showErrors({},'No se pudo guardar. Los datos se conservan para reintentar.'); }
        finally { inFlight.current=false;setPending(false); }
      }}>
        <FormErrorSummary/><p><strong>{data.name}</strong></p>
        <fieldset className="coordination-modal-form-fields" disabled={pending}>
          <input type="hidden" name="version" value={data.version} />
          <StaffParticipationFields starts={data.starts} ends={data.ends} flexible={data.flexible} general={data.general} transport={transport} onTransport={setTransport} seats={data.seats} food={data.food} other={data.other} interested70={data.interested70} legacySeats={data.legacySeats}/>
          {data.confirmed&&data.flexible&&<p className="muted">Si cambiás las fechas, la inscripción volverá a revisión y conservará su cupo reservado. Deberás confirmar las nuevas fechas.</p>}
        </fieldset>
      </form></FormFeedbackProvider>}
    </CoordinationModal>
  </>;
}
