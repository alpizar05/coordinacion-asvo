'use client';
import { navigationSaved } from './navigation-position';
import {useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {FormFeedbackProvider,FormErrorSummary,useFormFeedback} from '../form-feedback/form-feedback';
import {StatusRibbon} from '../status-ribbon';
import {ActionModal} from './action-modal';
import {validateRegistryForm,type RegistryFormKind} from '../../lib/registry-validation';
import type {FormResult} from '../../lib/form-result';
export function RegistryModal({kind,...props}:{kind:RegistryFormKind}&Omit<Parameters<typeof ActionModal>[0],'validate'>){return <ActionModal {...props} validate={form=>validateRegistryForm(form,kind)}/>;}
export function RegistryForm({kind,action,children,successMessage}:{kind:RegistryFormKind;action:(f:FormData)=>Promise<FormResult>;children:ReactNode;successMessage:string}){
 const form=useRef<HTMLFormElement>(null),busy=useRef(false),router=useRouter();
 const [pending,setPending]=useState(false),[success,setSuccess]=useState({id:0,message:''});
 const feedback=useFormFeedback({form,validate:f=>validateRegistryForm(f,kind),dependencies:{starts:['ends'],role:['unit']}});
 return <FormFeedbackProvider feedback={feedback}><StatusRibbon key={success.id} message={success.message}/><form ref={form} noValidate onChange={e=>{const t=e.target;if(t instanceof HTMLInputElement||t instanceof HTMLSelectElement||t instanceof HTMLTextAreaElement)feedback.changed(t.name);}} onSubmit={async e=>{
  e.preventDefault();if(busy.current)return;
  const f=new FormData(e.currentTarget,(e.nativeEvent as SubmitEvent).submitter),errors=validateRegistryForm(f,kind);
  if(Object.keys(errors).length){feedback.showErrors(errors);return;}
  busy.current=true;setPending(true);
  try{const result=await action(f);if(!result.saved)feedback.showErrors(result.fieldErrors,result.error);else{navigationSaved();feedback.reset();if(kind==='incident')form.current?.reset();setSuccess(p=>({id:p.id+1,message:successMessage}));router.refresh();}}
  catch{feedback.showErrors({},'No se pudo guardar. Los datos se conservan para reintentar.');}
  finally{busy.current=false;setPending(false);}
 }}><FormErrorSummary/><fieldset disabled={pending} className="coordination-modal-form-fields">{children}</fieldset></form></FormFeedbackProvider>;
}
