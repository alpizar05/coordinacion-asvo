import {validFormDate as date} from './form-dates.mjs';
import type { FieldErrors, FormResult } from './form-result';
import {formText as value,scalarInputErrors} from './form-input';

export type RegistrationField = 'identification'|'starts'|'ends'|'transport'|'rides'|'food'|'other'|'reason'|'acknowledge';
export type RegistrationSchedule = {flexible:boolean;starts:string;ends:string};
export type RegistrationActionResult<Success extends object = object> = FormResult<RegistrationField,Success> & { issue?: {title:string;message:string} };
export const registrationFieldLabels = { identification:'Número de identificación',starts:'Llegada',ends:'Regreso',transport:'Transporte propio',rides:'Personas que puedo llevar',food:'Restricciones alimentarias',other:'Otro detalle',reason:'Motivo de la cancelación',acknowledge:'Aceptación de gastos' };
export const registrationLimits={rides:100,detail:500,reason:2000} as const;

export function validateParticipation(form:FormData,schedule:RegistrationSchedule,identify=false, fixedDates:'published'|'submitted'='published'):FieldErrors<RegistrationField>{
  const errors:FieldErrors<RegistrationField>={};
  if(identify&&!/^[0-9]{9}$/.test(String(form.get('identification')??''))) errors.identification='Ingresá exactamente 9 dígitos, sin espacios ni guiones. Ejemplo: 102340567.';
  if(schedule.flexible||fixedDates==='submitted'){
    const starts=value(form,'starts'),ends=value(form,'ends');
    if(!date(starts))errors.starts='Indicá una fecha de llegada válida.';
    if(!date(ends))errors.ends='Indicá una fecha de regreso válida.';
    if(!errors.starts&&!errors.ends){
      if(ends<starts)errors.ends='El regreso debe ser igual o posterior a la llegada.';
      else if(ends<schedule.starts||starts>schedule.ends){
        errors.starts='Las fechas deben coincidir al menos un día con el periodo de la salida.';
        errors.ends='Las fechas deben coincidir al menos un día con el periodo de la salida.';
      }
    }
  }
  if(!schedule.flexible&&fixedDates==='submitted'){
    if(value(form,'starts')!==schedule.starts)errors.starts='La llegada debe coincidir con la fecha de la salida.';
    if(value(form,'ends')!==schedule.ends)errors.ends='El regreso debe coincidir con la fecha de la salida.';
  }
  const transport=value(form,'transport');
  if(transport&&transport!=='on')errors.transport='Indicá si tenés transporte propio.';
  if(transport==='on'){
    const raw=value(form,'rides'),rides=Number(raw);
    if(!/^[0-9]+$/.test(raw)||!Number.isSafeInteger(rides)||rides<0||rides>registrationLimits.rides)errors.rides='Ingresá un número entero entre 0 y 100.';
  }
  if(value(form,'food').length>registrationLimits.detail)errors.food='Usá hasta 500 caracteres.';
  if(value(form,'other').length>registrationLimits.detail)errors.other='Usá hasta 500 caracteres.';
  return {...errors,...scalarInputErrors(form,[...(identify?['identification']:[]),'starts','ends','transport','rides','food','other','lead'])};
}
export function validateCancellation(form:FormData,warning:boolean):FieldErrors<RegistrationField>{
  const errors:FieldErrors<RegistrationField>={};
  if(!value(form,'reason'))errors.reason='Indicá el motivo de la cancelación.';
  else if(value(form,'reason').length>registrationLimits.reason)errors.reason='Usá hasta 2000 caracteres.';
  if(warning&&value(form,'acknowledge')!=='on')errors.acknowledge='Confirmá que entendés la responsabilidad por los gastos ya incurridos.';
  return {...errors,...scalarInputErrors(form,['reason','acknowledge'])};
}
export function registrationDetails(form:FormData,general:boolean){
  const transport=value(form,'transport')==='on';
  return {transporte:transport,ofreceTransporte:transport?Number(value(form,'rides')):0,
    alimentacion:value(form,'food'),interes70:general&&value(form,'lead')==='on',otro:value(form,'other')};
}

/** The same rules at service boundaries, without trusting the action's TypeScript types. */
export function validateRegistrationData(starts:unknown,ends:unknown,details:unknown,schedule:RegistrationSchedule):FieldErrors {
  const form=new FormData(),errors:FieldErrors={};
  for(const [name,input] of Object.entries({starts,ends})){
    if(typeof input==='string')form.set(name,input);else errors[name]='Indicá una fecha válida.';
  }
  if(!details||typeof details!=='object'||Array.isArray(details))return {...validateParticipation(form,schedule,false,'submitted'),...errors,transport:'Revisá los datos de transporte.'};
  const d=details as Record<string,unknown>;
  if(d.transporte!==undefined&&typeof d.transporte!=='boolean')errors.transport='Indicá si tenés transporte propio.';
  if(d.transporte===true)form.set('transport','on');
  if(d.ofreceTransporte!==undefined&&typeof d.ofreceTransporte!=='number')errors.rides='Ingresá un número entero entre 0 y 100.';
  form.set('rides',String(d.ofreceTransporte??0));
  for(const [name,key]of [['food','alimentacion'],['other','otro']]){
    if(d[key]!==undefined&&typeof d[key]!=='string')errors[name]='Revisá el texto de este campo.';
    else form.set(name,(d[key] as string|undefined)??'');
  }
  return {...validateParticipation(form,schedule,false,'submitted'),...errors};
}
