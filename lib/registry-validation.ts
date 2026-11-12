import {validFormDate as date} from './form-dates.mjs';
import type { FieldErrors } from './form-result';
const value=(f:FormData,n:string)=>String(f.get(n)??'').trim();
const uuid=(s:string)=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
export type RegistryFormKind='policy'|'incident'|'attendance'|'grant';
export function validateRegistryForm(form:FormData,kind:RegistryFormKind):FieldErrors{
 const errors:FieldErrors={};
 const required=(n:string,message:string,max=4000)=>{if(!value(form,n)||value(form,n).length>max)errors[n]=message;};
 if(kind==='policy'){
  required('kind','Indicá el tipo de póliza.',200);required('number','Indicá el número de póliza.',200);required('source','Indicá la fuente de verificación.',1000);
  if(!date(value(form,'starts')))errors.starts='Indicá una fecha de inicio válida.';
  if(!date(value(form,'ends')))errors.ends='Indicá una fecha de fin válida.';
  else if(date(value(form,'starts'))&&value(form,'ends')<value(form,'starts'))errors.ends='El fin debe ser igual o posterior al inicio.';
 }
 if(kind==='incident'){
  if(!date(value(form,'occurred_on')))errors.occurred_on='Indicá una fecha válida.';
  required('description','Describí el incidente usando hasta 4000 caracteres.');
  if(value(form,'outing')&&!uuid(value(form,'outing')))errors.outing='Seleccioná una salida válida o incidente general.';
 }
 if(kind==='attendance'){
  if(!['participo','no_participo','pendiente'].includes(value(form,'decision')))errors.decision='Seleccioná una decisión.';
  required('reason','Indicá un motivo de hasta 4000 caracteres.');
 }
 if(kind==='grant'){
  if(!uuid(value(form,'subject'))&&value(form,'subject')!=='local-coordination')errors.subject='Ingresá un identificador de objeto Entra válido.';
  if(!['admin','general','unidad'].includes(value(form,'role')))errors.role='Seleccioná un rol válido.';
  if(value(form,'role')==='unidad'&&!value(form,'unit'))errors.unit='Seleccioná una unidad.';
  if(!['asignar','revocar'].includes(value(form,'action')))errors.action='Seleccioná Asignar o Revocar.';
 }
 return errors;
}
