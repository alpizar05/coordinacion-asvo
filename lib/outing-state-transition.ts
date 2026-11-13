import type {Transaction} from './registration';
import {audit} from './registration';
import {notifyRegistration} from './registration-workflow';
import {outingTransition,outingCancellationTransition} from './workflow-transitions';
type Decision=ReturnType<typeof outingTransition>;
/** Caller authorizes and holds the original outing/request locks and validates all input first. */
export async function applyOutingState(tx:Transaction,id:string,actor:string,decision:Decision,reason:string,title:string){
 if('error' in decision)throw Error('No se puede aplicar una transición rechazada.');
 if('noop' in decision)return;
 if(decision.status===null){
  await tx`delete from outing_photos where outing_id=${id}`;
  await tx`delete from outings where id=${id}`;
  await audit(tx,actor,decision.audit,id,title);
  return;
 }
 await tx`update outings set status=${decision.status} where id=${id}`;
 if(decision.status==='cancelada'){
  const cancellation=outingCancellationTransition(reason);
  const entries=await tx`update registrations set status=${cancellation.status} where outing_id=${id}
    and status in ('validación','revisión','espera','confirmada') returning id`;
  for(const entry of entries)await notifyRegistration(tx,entry.id,cancellation.message);
  await audit(tx,actor,decision.audit,id,reason);
 }else await audit(tx,actor,decision.audit,id);
}
