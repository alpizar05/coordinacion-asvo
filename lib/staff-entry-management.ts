import {outingIsOpen} from './workflow-transitions';
import type { FormResult } from './form-result';
import { eligible,field,identification,type Transaction } from './registration';
import { recoverRegistration,assignRegistration70,changeRegistrationStatus } from './registration-workflow';
import { validateEntryManagement } from './staff-registration-validation';

export async function manageStaffEntry(tx:Transaction,id:string,form:FormData,context:{actor:string;canOperate:(unit:string)=>boolean}):Promise<FormResult>{
  const [ref]=await tx`select outing_id from registrations where id=${id}`;
  if(!ref)return {error:'La inscripción ya no está disponible.'};
  const [outing]=await tx`select id,unit,status,flexible,capacity,starts::text as first_day,ends::text as last_day from outings where id=${ref.outing_id} for update`;
  if(!outing||!context.canOperate(outing.unit))return {error:'No tenés permiso para gestionar esta inscripción.'};
  const [entry]=await tx`select r.*,md5(to_jsonb(r)::text) as version,starts::text as first_day,ends::text as last_day from registrations r where id=${id} for update`;
  if(!entry||entry.outing_id!==outing.id||field(form,'version')!==entry.version||field(form,'schedule')!==`${outing.first_day}/${outing.last_day}/${outing.flexible}`)return {error:'La inscripción o la salida cambió. Cerrá el panel y volvé a abrirlo para revisar los datos actuales.'};
  if(!outingIsOpen(outing.status))return {error:'La salida debe estar abierta o confirmada.'};
  const action=field(form,'action');
  if(!['asignar70','quitar70','validar','confirmar','espera','rechazar','cancelar'].includes(action))return {error:'Elegí una acción válida.'};
  if(action==='validar'&&entry.status!=='validación')return {error:'La inscripción ya no está pendiente de recuperación.'};
  const approval=outing.flexible&&(entry.first_day<outing.first_day||entry.last_day>outing.last_day)?`${entry.first_day}/${entry.last_day}`:undefined;
  const fieldErrors=validateEntryManagement(form,action,approval);
  if(Object.keys(fieldErrors).length)return {fieldErrors};
  if(action==='asignar70'||action==='quitar70'){
    const error=await assignRegistration70(tx,id,context.actor,action==='asignar70');
    return error?{error}:{saved:true};
  }
  if(action==='validar'){
    const [person]=await tx`select id,email from volunteers where identification=${identification(field(form,'identification'))}`;
    if(!person)return {fieldErrors:{identification:'No encontramos esa identificación en el registro de voluntariado.'}};
    if(!person.email||!await eligible(tx,person.id,outing.unit))return {error:'Revisá la ficha, el correo y la unidad de la persona.'};
    if((await tx`select 1 from registrations where outing_id=${outing.id} and volunteer_id=${person.id} and status in ('revisión','espera','confirmada') and id<>${id}`).length)return {error:'La persona ya tiene una inscripción activa en esta salida.'};
    await recoverRegistration(tx,id,{id:String(outing.id),capacity:Number(outing.capacity)},person.id,context.actor);
    return {saved:true};
  }
  const error=await changeRegistrationStatus(tx,id,context.actor,action,field(form,'reason'),field(form,'approveDates'));
  return error?{error}:{saved:true};
}
