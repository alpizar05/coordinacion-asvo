'use client';

import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegistrationFields } from '../fields';
import { FormFeedbackProvider,FormErrorSummary,FormField,useFormFeedback } from '../form-feedback/form-feedback';
import { StatusRibbon } from '../status-ribbon';
import { RegistrationResultModal } from '../registration-result-modal';
import { submitPrivateRegistration } from '../public-actions';
import { validateParticipation,validateCancellation,registrationFieldLabels,type RegistrationActionResult,type RegistrationSchedule } from '../../lib/registration-validation';
import { fieldErrorMessages } from '../../lib/form-result';

type Props={token:string;active:boolean;warning:boolean;general:boolean;schedule:RegistrationSchedule;arrival:string;departure:string;details:Record<string,string|boolean|number>};
export function PrivateRegistrationForms(props:Props){
  const [success,setSuccess]=useState({id:0,message:''});
  const router=useRouter();
  const saved=(mode:string)=>{setSuccess(previous=>({id:previous.id+1,message:mode==='cancelar'?'Inscripción cancelada.':'Inscripción actualizada.'}));router.refresh();};
  return <><StatusRibbon key={success.id} message={success.message}/>{props.active&&<>
    <PrivateForm {...props} mode="editar" onSaved={saved}/>
    <PrivateForm {...props} mode="cancelar" onSaved={saved}/>
  </>}</>;
}
function PrivateForm(props:Props&{mode:'editar'|'cancelar';onSaved:(mode:string)=>void}){
  const form=useRef<HTMLFormElement>(null),inFlight=useRef(false);
  const [pending,setPending]=useState(false),[requireAck,setRequireAck]=useState(false);
  const [issue,setIssue]=useState<(NonNullable<RegistrationActionResult['issue']>&{id:number})|null>(null);
  const warning=props.warning||requireAck;
  const validate=(data:FormData)=>props.mode==='editar'?validateParticipation(data,props.schedule):validateCancellation(data,warning);
  const feedback=useFormFeedback({form,validate,labels:registrationFieldLabels,dependencies:{starts:['ends'],ends:['starts'],transport:['rides']}});
  return <FormFeedbackProvider feedback={feedback}><form ref={form} className="card" noValidate onChange={event=>{const input=event.target;if(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)feedback.changed(input.name);}}
    onSubmit={async event=>{
      event.preventDefault();if(inFlight.current)return;
      const data=new FormData(event.currentTarget);data.set('action',props.mode);
      const errors=validate(data);
      if(Object.values(errors).some(value=>fieldErrorMessages(value).length)){feedback.showErrors(errors);return;}
      inFlight.current=true;setPending(true);setIssue(null);
      try{
        const result=await submitPrivateRegistration(props.token,data);
        if(!result.saved){if(result.fieldErrors?.acknowledge)setRequireAck(true);feedback.showErrors(result.fieldErrors,result.error);if(result.issue)setIssue({...result.issue,id:Date.now()});}
        else{feedback.reset();props.onSaved(props.mode);}
      }catch{feedback.showErrors({},'No se pudo aplicar el cambio. Tus datos se conservan para reintentar.');}
      finally{inFlight.current=false;setPending(false);}
    }}>
    <h2>{props.mode==='editar'?'Editar inscripción':'Cancelar mi inscripción'}</h2>
    <FormErrorSummary/>
    <fieldset disabled={pending} className="registration-form-fields">
      {props.mode==='editar'?<>
        {props.schedule.flexible&&<p>Para apoyar un solo día, elegí la misma fecha de llegada y regreso. Las fechas fuera del rango publicado requieren aprobación de Coordinación.</p>}
        <RegistrationFields flexible={props.schedule.flexible} general={props.general} starts={props.schedule.starts} ends={props.schedule.ends} details={props.details} arrival={props.arrival} departure={props.departure}/>
      </>:<>
        {warning&&<FormField name="acknowledge" label="Entiendo que deberé cubrir los gastos ya incurridos según el reglamento."><input type="checkbox" name="acknowledge" required/></FormField>}
        <FormField name="reason" label="Motivo de la cancelación"><textarea name="reason" required maxLength={2000}/></FormField>
      </>}
    </fieldset>
    <button type="submit" disabled={pending}>{pending?'Guardando…':props.mode==='editar'?'Guardar cambios':'Cancelar mi inscripción'}</button>
    {issue&&<RegistrationResultModal key={issue.id} title={issue.title} paragraphs={[issue.message]} keepRegistrationOpen onDismiss={()=>{setIssue(null);requestAnimationFrame(()=>feedback.summary.current?.focus());}}/>}
  </form></FormFeedbackProvider>;
}
