import {validFormDate as date} from './form-dates.mjs';
import type { FieldErrors, FormResult } from './form-result';

export type RegistrationField = 'identification'|'starts'|'ends'|'transport'|'rides'|'food'|'other'|'reason'|'acknowledge';
export type RegistrationSchedule = {flexible:boolean;starts:string;ends:string};
export type RegistrationActionResult = FormResult<RegistrationField> & { issue?: {title:string;message:string} };
export const registrationFieldLabels = { identification:'Número de identificación',starts:'Llegada',ends:'Regreso',transport:'Transporte propio',rides:'Personas que puedo llevar',food:'Restricciones alimentarias',other:'Otro detalle',reason:'Motivo de la cancelación',acknowledge:'Aceptación de gastos' };
const value=(form:FormData,key:string)=>String(form.get(key)??'').trim();

export function validateParticipation(form:FormData,schedule:RegistrationSchedule,identify=false):FieldErrors<RegistrationField>{
  const errors:FieldErrors<RegistrationField>={};
  if(identify&&!/^[0-9]{9}$/.test(String(form.get('identification')??''))) errors.identification='Ingresá exactamente 9 dígitos, sin espacios ni guiones. Ejemplo: 102340567.';
  if(schedule.flexible){
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
  const transport=value(form,'transport');
  if(transport&&transport!=='on')errors.transport='Indicá si tenés transporte propio.';
  if(transport==='on'){
    const raw=value(form,'rides'),rides=Number(raw);
    if(!/^[0-9]+$/.test(raw)||!Number.isSafeInteger(rides)||rides<0||rides>100)errors.rides='Ingresá un número entero entre 0 y 100.';
  }
  if(value(form,'food').length>500)errors.food='Usá hasta 500 caracteres.';
  if(value(form,'other').length>500)errors.other='Usá hasta 500 caracteres.';
  return errors;
}
export function validateCancellation(form:FormData,warning:boolean):FieldErrors<RegistrationField>{
  const errors:FieldErrors<RegistrationField>={};
  if(!value(form,'reason'))errors.reason='Indicá el motivo de la cancelación.';
  else if(value(form,'reason').length>2000)errors.reason='Usá hasta 2000 caracteres.';
  if(warning&&value(form,'acknowledge')!=='on')errors.acknowledge='Confirmá que entendés la responsabilidad por los gastos ya incurridos.';
  return errors;
}
export function registrationDetails(form:FormData,general:boolean){
  const transport=value(form,'transport')==='on';
  return {transporte:transport,ofreceTransporte:transport?Number(value(form,'rides')):0,
    alimentacion:value(form,'food'),interes70:general&&value(form,'lead')==='on',otro:value(form,'other')};
}
