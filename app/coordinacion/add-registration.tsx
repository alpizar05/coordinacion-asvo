'use client';
import { navigationSaved } from './navigation-position';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoordinationModal } from './coordination-modal';
import { StatusRibbon } from '../status-ribbon';
import { StaffParticipationFields } from './staff-participation-fields';
import { FormFeedbackProvider,FormErrorSummary,FormField,useFormFeedback } from '../form-feedback/form-feedback';
import { validateStaffParticipation,staffRegistrationLabels } from '../../lib/staff-registration-validation';
import { fieldErrorMessages } from '../../lib/form-result';
import { addRegistration, findRegistrationVolunteers } from './add-registration-actions';

type Person = { id: string; name: string; identification: string };
export function AddRegistration({ outing }: { outing: { id: string; starts: string; ends: string; flexible: boolean; general: boolean } }) {
  const [open,setOpen] = useState(false), [dirty,setDirty] = useState(false), [pending,setPending] = useState(false);
  const [query,setQuery] = useState(''), [people,setPeople] = useState<Person[]>([]), [selected,setSelected] = useState<Person | null>(null);
  const [searching,setSearching] = useState(false), [searchMessage,setSearchMessage] = useState('');
  const [transport,setTransport] = useState(false), [success,setSuccess] = useState('');
  const form=useRef<HTMLFormElement>(null),inFlight=useRef(false);
  const feedback=useFormFeedback({form,validate:data=>({...validateStaffParticipation(data,outing,true),...(!selected?{volunteer:'Seleccioná una persona del registro de voluntariado.'}:{})}),labels:staffRegistrationLabels,dependencies:{starts:['ends'],ends:['starts'],transport:['rides']}});
  const formId = useId(), router = useRouter();
  useEffect(() => {
    if (!open || selected || query.trim().length < 2) { setPeople([]); setSearching(false); return; }
    let active = true;
    setPeople([]); setSearching(true); setSearchMessage('');
    const timer = setTimeout(async () => {
      try {
        const result = await findRegistrationVolunteers(outing.id,query);
        if (!active) return;
        setPeople(result.people);
        setSearchMessage(result.error || (result.total && result.total > result.people.length ? 'Mostrando las primeras 25 coincidencias. Precisá la búsqueda.' : result.people.length ? '' : 'No se encontraron personas para esta salida.'));
      } catch { if (active) setSearchMessage('No se pudo buscar. Intentá de nuevo.'); }
      finally { if (active) setSearching(false); }
    },300);
    return () => { active = false; clearTimeout(timer); };
  },[query,selected,open,outing.id]);
  return <>
    <StatusRibbon message={success} onExpire={setSuccess} />
    <button type="button" aria-haspopup="dialog" onClick={() => {
      setSelected(null); setQuery(''); setPeople([]); feedback.reset(); setSearchMessage(''); setDirty(false); setTransport(false); setOpen(true);
    }}>Agregar persona</button>
    <CoordinationModal title="Agregar persona a la salida" open={open} onClose={() => setOpen(false)} dirty={dirty} pending={pending}
      footer={<button type="submit" form={formId} disabled={pending} className="coord-button-primary">{pending ? 'Agregando…' : 'Agregar inscripción'}</button>}>
      {open && <FormFeedbackProvider feedback={feedback}><form ref={form} id={formId} noValidate onChange={event=>{setDirty(true);const input=event.target;if(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)feedback.changed(input.name);}} onSubmit={async event => {
        event.preventDefault(); if (inFlight.current) return;
        const data = new FormData(event.currentTarget);
        const errors={...validateStaffParticipation(data,outing,true),...(!selected?{volunteer:'Seleccioná una persona del registro de voluntariado.'}:{})};
        if(Object.values(errors).some(value=>fieldErrorMessages(value).length)){feedback.showErrors(errors);return;}
        inFlight.current=true;setPending(true);
        try {
          const result = await addRegistration(outing.id,data);
          if (!result.saved) { feedback.showErrors(result.fieldErrors,result.fieldErrors?undefined:result.error); }
          else {
            navigationSaved();setDirty(false); setOpen(false);
            setSuccess(`${selected?.name}: inscripción agregada ${result.status === 'espera' ? 'a lista de espera' : 'en revisión'}. Se notificará por correo.`);
            router.refresh();
          }
        } catch { feedback.showErrors({},'No se pudo agregar la inscripción. Los datos se conservan para reintentar.'); }
        finally { inFlight.current=false;setPending(false); }
      }}>
        <FormErrorSummary/>
        <fieldset disabled={pending} className="coordination-modal-form-fields">
          <input type="hidden" name="schedule" value={`${outing.starts}/${outing.ends}/${outing.flexible}`} />
          {selected ? <div className="card"><strong>{selected.name}</strong><p>Identificación: {selected.identification}</p>
            <input type="hidden" name="volunteer" value={selected.id} />
            <FormField name="volunteer" label="Persona seleccionada"><button name="volunteer" type="button" onClick={() => { setSelected(null); setDirty(true); }}>Cambiar persona</button></FormField></div>
            : <><FormField name="volunteer" label="Buscar persona voluntaria"><input name="volunteer" type="search" value={query} maxLength={120} autoComplete="off"
              placeholder="Nombre, identificación o correo" onChange={e => { setQuery(e.target.value); setDirty(true); }} /></FormField>
              <p className="muted" role="status">{searching ? 'Buscando…' : query.trim().length < 2 ? 'Escribí al menos 2 caracteres.' : searchMessage}</p>
              <ul className="registration-person-results">{people.map(person => <li key={person.id}><button type="button" onClick={() => { setSelected(person); setDirty(true); requestAnimationFrame(()=>feedback.changed('volunteer')); }}>
                <strong>{person.name}</strong><span>{person.identification}</span></button></li>)}</ul></>}
          <StaffParticipationFields starts={outing.starts} ends={outing.ends} flexible={outing.flexible} general={outing.general} transport={transport} onTransport={setTransport}/>
          {outing.flexible&&<p className="muted">Podés indicar menos días o ampliar la participación. Las fechas deben intersectar el periodo de la salida; se revisarán al confirmar.</p>}
          <p className="muted">La inscripción queda en revisión si hay cupo o en lista de espera si está completo. Se enviará un correo a la persona voluntaria.</p>
        </fieldset>
      </form></FormFeedbackProvider>}
    </CoordinationModal>
  </>;
}
