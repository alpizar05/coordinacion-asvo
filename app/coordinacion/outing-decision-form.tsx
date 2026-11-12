'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {FormFeedbackProvider,FormErrorSummary,FormField,useFormFeedback} from '../form-feedback/form-feedback';
import {StatusRibbon} from '../status-ribbon';
import {validateOutingDecision,type OutingDecision} from '../../lib/outing-decision-validation';
import {decideOuting} from './outing-decision-actions';
export function OutingDecisionForm({id,version,action}:{id:string;version:string;action:OutingDecision}){
 const form=useRef<HTMLFormElement>(null),busy=useRef(false),router=useRouter();const[snapshot]=useState(version),[pending,setPending]=useState(false),[saved,setSaved]=useState({id:0,message:''});
 const feedback=useFormFeedback({form,validate:f=>validateOutingDecision(f,action)});
 const labels={'agrupación':'Registrar decisión',completar:'Marcar como completada','cancelar-salida':'Cancelar convocatoria',eliminar:'Eliminar convocatoria'};
 return <FormFeedbackProvider feedback={feedback}><StatusRibbon key={saved.id} message={saved.message}/><form ref={form} noValidate onChange={e=>{const t=e.target;if(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement)feedback.changed(t.name);}} onSubmit={async e=>{
  e.preventDefault();if(busy.current)return;const f=new FormData(e.currentTarget),errors=validateOutingDecision(f,action);if(Object.keys(errors).length){feedback.showErrors(errors);return;}busy.current=true;setPending(true);
  try{const result=await decideOuting(id,f);if(!result.saved)feedback.showErrors(result.fieldErrors,result.error);else if(result.destination){router.push(result.destination,{scroll:false});router.refresh();}else{form.current?.reset();feedback.reset();setSaved(p=>({id:p.id+1,message:'Decisión de agrupación registrada.'}));router.refresh();}}
  catch{feedback.showErrors({},'No se pudo guardar. La acción y los datos se conservan para reintentar.');}finally{busy.current=false;setPending(false);}
 }}><FormErrorSummary/><input type="hidden" name="version" value={snapshot}/><input type="hidden" name="action" value={action}/><fieldset disabled={pending} className="coordination-modal-form-fields">
 {action==='agrupación'||action==='cancelar-salida'?<FormField name="reason" label={action==='agrupación'?'Decisión de coordinación':'Motivo de la cancelación'}><textarea name="reason" rows={3}/></FormField>:<FormField name={action==='completar'?'confirmCompleted':'confirmDelete'} label={action==='completar'?'Confirmo que la actividad se realizó.':'Confirmo que quiero eliminar esta convocatoria.'}><input type="checkbox" name={action==='completar'?'confirmCompleted':'confirmDelete'}/></FormField>}
 <button type="submit" className={action==='eliminar'||action==='cancelar-salida'?'coord-button-danger':'coord-button-primary'}>{pending?'Guardando…':labels[action]}</button>
 </fieldset></form></FormFeedbackProvider>;
}
