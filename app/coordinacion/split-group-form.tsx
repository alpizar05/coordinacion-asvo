'use client';
import { ActionModal } from './action-modal';
import { FormField } from '../form-feedback/form-feedback';
import { validateSplitGroup,staffRegistrationLabels } from '../../lib/staff-registration-validation';
import { splitOutingGroup } from '../actions/outings';

export function SplitGroupForm({outingId,starts,ends,members,occupied,title}:{outingId:string;starts:string;ends:string;members:string[];occupied:number;title:string}){
 return <ActionModal title="Crear salida para este grupo" saveLabel="Crear salida y trasladar grupo" validate={form=>validateSplitGroup(form,occupied)} fieldLabels={staffRegistrationLabels} action={async form=>{
  const result=await splitOutingGroup(outingId,starts,ends,form);
  if(result.saved&&result.destination){
   const destination=new URL(result.destination,window.location.origin),current=new URL(window.location.href);
   for(const [name,value]of current.searchParams)if(!['error','errorGrupo','grupoCreado','gestionada','confirmacion'].includes(name)&&!destination.searchParams.has(name))destination.searchParams.set(name,value);
   return {...result,destination:`${destination.pathname}${destination.search}${destination.hash}`};
  }
  return result;
 }}>
  {members.map(id=><input key={id} name="member" type="hidden" value={id}/>)}
  <div className="grid"><FormField name="title" label="Título de la nueva salida"><input name="title" required maxLength={200} defaultValue={title}/></FormField>
  <FormField name="capacity" label="Cupos"><input name="capacity" type="number" required min={Math.max(1,occupied)} max={10000} defaultValue={Math.min(10000,members.length)}/></FormField></div>
  <p>Se crea una salida privada y flexible para estas fechas. Se trasladan las inscripciones de este grupo con sus estados y fechas. Las demás quedan en la salida original.</p>
 </ActionModal>;
}
