'use client';
import { useRef,useState } from 'react';
import { FormFeedbackProvider,FormErrorSummary,FormField,useFormFeedback } from '../form-feedback/form-feedback';
import { validateEntryManagement,staffRegistrationLabels } from '../../lib/staff-registration-validation';
import { checkedFormResult,fieldErrorMessages } from '../../lib/form-result';
import { manageRegistration } from '../actions/registrations';

type Entry={id:string;version:string;identification:string;starts:string;ends:string};
export function ManageRegistrationForm({entry,outing,action,title,onBack,onSaved,onPending}:{entry:Entry;outing:{flexible:boolean;first_day:string;last_day:string};action:string;title:string;onBack:()=>void;onSaved:()=>void;onPending:(value:boolean)=>void}){
 const form=useRef<HTMLFormElement>(null),inFlight=useRef(false);
 const [pending,setPending]=useState(false);
 const [snapshot]=useState({entry,outing,version:entry.version,schedule:`${outing.first_day}/${outing.last_day}/${outing.flexible}`});
 const approval=action==='confirmar'&&snapshot.outing.flexible&&(snapshot.entry.starts<snapshot.outing.first_day||snapshot.entry.ends>snapshot.outing.last_day)?`${snapshot.entry.starts}/${snapshot.entry.ends}`:undefined;
 const feedback=useFormFeedback({form,validate:data=>validateEntryManagement(data,action,approval),labels:staffRegistrationLabels});
 return <FormFeedbackProvider feedback={feedback}><form ref={form} noValidate onChange={event=>{const input=event.target;if(input instanceof HTMLInputElement)feedback.changed(input.name);}} onSubmit={async event=>{
  event.preventDefault();if(inFlight.current)return;
  const data=new FormData(event.currentTarget),errors=validateEntryManagement(data,action,approval);
  if(Object.values(errors).some(value=>fieldErrorMessages(value).length)){feedback.showErrors(errors);return;}
  inFlight.current=true;setPending(true);onPending(true);
  try{const result=checkedFormResult(await manageRegistration(entry.id,data));if(result.saved !== true)feedback.showErrors(result.fieldErrors,result.error);else onSaved();}
  catch{feedback.showErrors({},'No se pudo gestionar la inscripción. Tus datos se conservan para reintentar.');}
  finally{inFlight.current=false;setPending(false);onPending(false);}
 }}>
  <h3>{title}</h3><FormErrorSummary/>
  <fieldset disabled={pending} className="coordination-modal-form-fields">
   <input type="hidden" name="version" value={snapshot.version}/><input type="hidden" name="schedule" value={snapshot.schedule}/><input type="hidden" name="action" value={action}/>
   {action==='validar'&&<FormField name="identification" label="Identificación para conciliar"><input name="identification" defaultValue={entry.identification}/></FormField>}
   {approval&&<FormField name="approveDates" label="Apruebo las fechas solicitadas fuera del rango publicado."><input type="checkbox" name="approveDates" value={approval} required/></FormField>}
   {['espera','rechazar','cancelar'].includes(action)&&<FormField name="reason" label="Motivo"><input name="reason" required/></FormField>}
   <div className="actions"><button type="button" className="registration-sheet-back" onClick={onBack}>Volver</button><button type="submit" className={['rechazar','cancelar'].includes(action)?'coord-button-danger':'coord-button-primary'}>{pending?'Guardando…':title}</button></div>
  </fieldset>
 </form></FormFeedbackProvider>;
}
