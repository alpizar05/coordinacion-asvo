import {audit,field,outingIsEditable,type Transaction} from './registration';
import {outingEditVersion} from './outing-editor';
import {notifyRegistration} from './registration-workflow';
import {registrationToday} from './outing-invitations';
import {validateOutingDecision} from './outing-decision-validation';
import type {FormResult} from './form-result';
export async function saveOutingDecision(tx:Transaction,id:string,form:FormData,context:{actor:string;canOperate:(unit:string)=>boolean}):Promise<FormResult>{
 const[ref]=await tx`select request_id from outings where id=${id}`;if(!ref)return {error:'La convocatoria ya no está disponible.'};
 await tx`select id from requests where id=${ref.request_id} for update`;
 const[outing]=await tx`select *,ends::text as last_day from outings where id=${id} for update`;
 if(!outing||!context.canOperate(outing.unit))return {error:'No tenés permiso para gestionar esta salida.'};
 if(!outingIsEditable(outing.status))return {error:'Esta convocatoria está cerrada para edición.'};
 if(field(form,'version')!==await outingEditVersion(tx,id))return {error:'La convocatoria cambió. Actualizá la página antes de confirmar esta acción.'};
 const action=field(form,'action');
 if(!['agrupación','completar','cancelar-salida','eliminar'].includes(action))return {error:'La acción no está disponible.'};
 if(action==='agrupación'&&!outing.flexible)return {error:'Esta salida no admite decisiones de agrupación.'};
 if(action==='completar'){
  if(!['abierta','confirmada'].includes(outing.status))return {error:'Solo se puede completar una salida abierta o confirmada.'};
  const[{finished}]=await tx`select ${outing.last_day}::date<${registrationToday} as finished`;
  if(!finished)return {error:'Podés completar la salida a partir del día siguiente al regreso.'};
 }
 const[registration]=await tx`select 1 from registrations where outing_id=${id} limit 1`;
 if(action==='eliminar'&&registration)return {error:'La convocatoria tiene inscripciones. Podés cancelarla.'};
 if(action==='cancelar-salida'&&!registration)return {error:'La convocatoria no tiene inscripciones. Podés eliminarla.'};
 const errors=validateOutingDecision(form,action);if(Object.keys(errors).length)return {fieldErrors:errors};
 const reason=field(form,'reason');
 if(action==='agrupación'){
  // A retry with exactly the same content must not duplicate the decision in its history.
  const[previous]=await tx`select actor,reason from audit where target=${id} and action='Decidió agrupación' order by id desc limit 1`;
  if(previous?.reason!==reason||previous?.actor!==context.actor)await audit(tx,context.actor,'Decidió agrupación',id,reason);
  return {saved:true};
 }
 if(action==='completar'){await tx`update outings set status='completada' where id=${id}`;await audit(tx,context.actor,'Completó convocatoria',id);return {saved:true,destination:`/coordinacion/salidas/${id}?completada=1`};}
 if(action==='eliminar'){
  await tx`delete from outing_photos where outing_id=${id}`;await tx`delete from outings where id=${id}`;await audit(tx,context.actor,'Eliminó convocatoria',id,outing.title);
  return {saved:true,destination:'/coordinacion/convocatorias?confirmacion=eliminada#salidas'};
 }
 await tx`update outings set status='cancelada' where id=${id}`;
 const cancelled=await tx`update registrations set status='cancelada por coordinación' where outing_id=${id} and status in ('validación','revisión','espera','confirmada') returning id`;
 for(const entry of cancelled)await notifyRegistration(tx,entry.id,`Coordinación canceló la salida. Motivo: ${reason}`);
 await audit(tx,context.actor,'Canceló convocatoria',id,reason);
 return {saved:true,destination:`/coordinacion/salidas/${id}?confirmacion=cancelada`};
}
