import type { FieldErrors } from './form-result';
import { validateParticipation, type RegistrationSchedule } from './registration-validation';

export const staffRegistrationLabels = {volunteer:'Persona voluntaria',identification:'Identificación para conciliar',starts:'Llegada',ends:'Regreso',transport:'Transporte propio',rides:'Personas que puede llevar',food:'Restricciones alimentarias',other:'Observaciones',reason:'Motivo',approveDates:'Aprobación de fechas',title:'Título de la nueva salida',capacity:'Cupos'};
const value=(form:FormData,key:string)=>String(form.get(key)??'').trim();
export function validateStaffParticipation(form:FormData,schedule:RegistrationSchedule,selectPerson=false):FieldErrors{
  const errors:FieldErrors={...validateParticipation(form,{...schedule,flexible:true})};
  if(!schedule.flexible){
    if(value(form,'starts')!==schedule.starts)errors.starts='La llegada debe coincidir con la fecha de la salida.';
    if(value(form,'ends')!==schedule.ends)errors.ends='El regreso debe coincidir con la fecha de la salida.';
  }
  if(selectPerson&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value(form,'volunteer')))errors.volunteer='Seleccioná una persona del registro de voluntariado.';
  return errors;
}
export function validateEntryManagement(form:FormData,action:string,approval?:string):FieldErrors{
  const errors:FieldErrors={};
  if(['espera','rechazar','cancelar'].includes(action)&&!value(form,'reason'))errors.reason='Indicá el motivo de esta decisión.';
  if(action==='confirmar'&&approval&&value(form,'approveDates')!==approval)errors.approveDates='Revisá y aprobá las fechas solicitadas fuera del rango publicado.';
  if(action==='validar'){
    const number=value(form,'identification').toUpperCase().replace(/[\s-]/g,'');
    // Recovery must also support the historical identifiers already accepted by Coordination.
    if(!/^[A-Z0-9]{4,30}$/.test(number))errors.identification='Ingresá una identificación válida del registro de voluntariado.';
  }
  return errors;
}
export function validateSplitGroup(form:FormData,occupied=0):FieldErrors{
  const errors:FieldErrors={};
  if(!value(form,'title'))errors.title='Ingresá el título de la nueva salida.';
  else if(value(form,'title').length>200)errors.title='Usá hasta 200 caracteres.';
  const raw=value(form,'capacity'),capacity=Number(raw),minimum=Math.max(1,occupied);
  if(!raw||!Number.isInteger(capacity)||capacity<minimum||capacity>10000)errors.capacity=`Ingresá entre ${minimum} y 10 000 cupos${occupied?' para conservar las reservas':''}.`;
  return errors;
}
