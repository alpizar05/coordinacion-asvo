'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FormFeedbackProvider,FormErrorSummary,FormField,useFormFeedback } from './form-feedback/form-feedback';
import { RegistrationResultModal } from './registration-result-modal';
import { validateParticipation,registrationFieldLabels,type RegistrationActionResult,type RegistrationSchedule } from '../lib/registration-validation';
import { fieldErrorMessages } from '../lib/form-result';

const savedKey = 'asvo-registration-preferences-v1';
const pendingKey = 'asvo-registration-preferences-pending-v1';
const lifetime = 90 * 24 * 60 * 60 * 1000;
type Preferences = { identification: string; transport: boolean; rides: number; food: string };
function valid(value: unknown): value is Preferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as Preferences;
  return typeof p.identification === 'string' && /^[0-9]{9}$/.test(p.identification) &&
    typeof p.food === 'string' && p.food.length <= 500 && typeof p.transport === 'boolean' && Number.isSafeInteger(p.rides) && p.rides >= 0;
}

export function RememberRegistrationForm({ action, outingId, schedule, children }: {
  action: (data: FormData) => Promise<RegistrationActionResult>; outingId: string; schedule: RegistrationSchedule; children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const router=useRouter();
  const helpId=useId();
  const [pending,setPending]=useState(false);
  const inFlight=useRef(false);
  const [issue,setIssue]=useState<(NonNullable<RegistrationActionResult['issue']>&{id:number})|null>(null);
  const feedback=useFormFeedback({form,validate:data=>validateParticipation(data,schedule,true),labels:registrationFieldLabels,dependencies:{starts:['ends'],ends:['starts'],transport:['rides']}});
  const [remember, setRemember] = useState(false);
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(savedKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // Earlier preferences recorded availability without a seat count.
      if (saved?.data && typeof saved.data.rides === 'boolean') saved.data.rides = 0;
      if (!valid(saved.data) || typeof saved.expires !== 'number' || saved.expires <= Date.now()) {
        localStorage.removeItem(savedKey); return;
      }
      for (const name of ['identification', 'transport', 'rides', 'food'] as const) {
        const input = form.current?.elements.namedItem(name);
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
          if (typeof saved.data[name] === 'boolean' && input instanceof HTMLInputElement) input.checked = saved.data[name];
          else input.value = String(saved.data[name]);
        }
      }
      form.current?.querySelector('[name=transport]')?.dispatchEvent(new Event('change', { bubbles: true }));
      setRemember(true);
    } catch { setAvailable(false); }
  }, []);
  function forget() {
    try { localStorage.removeItem(savedKey); sessionStorage.removeItem(pendingKey); }
    catch { setAvailable(false); }
    setRemember(false);
    setMessage('Los datos guardados en este navegador se eliminaron.');
  }
  return <FormFeedbackProvider feedback={feedback}><form ref={form} noValidate onChange={event=>{const input=event.target;if(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)feedback.changed(input.name);}} onPaste={event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.name === 'identification') {
      event.preventDefault();
      const digits = event.clipboardData.getData('text').replace(/[^0-9]/g, '');
      if (!digits) return;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      input.value = (input.value.slice(0,start) + digits + input.value.slice(end)).slice(0,9);
      const cursor = Math.min(start + digits.length,input.value.length);
      input.setSelectionRange(cursor,cursor);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      feedback.changed('identification');
    }
  }} onInput={event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.name === 'identification') {
      const cleaned = input.value.replace(/[^0-9]/g, '').slice(0,9);
      if (cleaned !== input.value) {
        const cursor = input.selectionStart ?? input.value.length;
        const position = input.value.slice(0,cursor).replace(/[^0-9]/g, '').length;
        input.value = cleaned;
        input.setSelectionRange(Math.min(position,9),Math.min(position,9));
      }
    }
    if(input instanceof HTMLInputElement && input.name==='identification')feedback.changed('identification');
  }} onSubmit={async event => {
    event.preventDefault();
    if(inFlight.current)return;
    const data=new FormData(event.currentTarget);
    const errors=validateParticipation(data,schedule,true);
    if(Object.values(errors).some(value=>fieldErrorMessages(value).length)){feedback.showErrors(errors);return;}
    inFlight.current=true;setPending(true);setIssue(null);
    try{
      const result=await action(data);
      if(!result.saved){feedback.showErrors(result.fieldErrors,result.error);if(result.issue)setIssue({...result.issue,id:Date.now()});return;}
      try {
      sessionStorage.removeItem(pendingKey);
      if (remember) {
        sessionStorage.setItem(pendingKey, JSON.stringify({ outingId, created: Date.now(), data: {
          identification: String(data.get('identification') || ''), transport: data.get('transport') === 'on',
          rides: data.get('transport') === 'on' ? Number(data.get('rides') || 0) : 0, food: String(data.get('food') || ''),
        } }));
      }
      } catch { setMessage('Este navegador no permite recordar los datos. Tu inscripción fue recibida igualmente.'); }
      if(result.destination)router.replace(result.destination,{scroll:false});
    }catch{feedback.showErrors({},'No se pudo completar el envío. Tus datos se conservan para reintentar.');}
    finally{inFlight.current=false;setPending(false);}
  }}>
    <FormErrorSummary />
    <fieldset disabled={pending} className="registration-form-fields">
    <FormField name="identification" label="Número de identificación"><input name="identification" type="text" inputMode="numeric" required minLength={9} maxLength={9} pattern="[0-9]{9}" placeholder="102340567" aria-describedby={helpId} autoComplete="off" /></FormField>
    <p id={helpId} className="muted">9 dígitos, sin espacios ni guiones. Ejemplo: 102340567.</p>
    {children}
    <div className="remember-registration">
      <label><input type="checkbox" checked={remember} disabled={!available} onChange={event => {
        if (event.target.checked) { setRemember(true); setMessage(''); } else forget();
      }} /> Recordar mis datos en este dispositivo</label>
      <p className="muted">Usá esta opción solo en un dispositivo personal.</p>
      <p role="status">{message || (!available ? 'El almacenamiento de este navegador no está disponible.' : '')}</p>
    </div>
    </fieldset>
    <button type="submit" disabled={pending}>{pending?'Enviando…':'Enviar inscripción'}</button>
    {issue&&<RegistrationResultModal key={issue.id} title={issue.title} paragraphs={[issue.message]} keepRegistrationOpen onDismiss={()=>{setIssue(null);if(feedback.fieldErrors.identification)void feedback.focus('identification');else requestAnimationFrame(()=>feedback.summary.current?.focus());}} />}
  </form></FormFeedbackProvider>;
}

export function SaveRegistrationPreferences({ outingId }: { outingId: string }) {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(pendingKey);
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (pending.outingId !== outingId) return;
      sessionStorage.removeItem(pendingKey);
      if (!valid(pending.data) || typeof pending.created !== 'number' || pending.created > Date.now() || Date.now() - pending.created > 15 * 60 * 1000) return;
      localStorage.setItem(savedKey, JSON.stringify({ data: pending.data, expires: Date.now() + lifetime }));
    } catch { /* Browser storage is optional; registration has already succeeded. */ }
  }, [outingId]);
  return null;
}
