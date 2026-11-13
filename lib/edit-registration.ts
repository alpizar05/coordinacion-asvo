import {registrationIsActive,outingIsOpen,editRegistrationTransition} from './workflow-transitions';
import {registrationCoverage} from './registration-coverage';
import {validateRegistrationData} from './registration-validation';
import type { FormResult } from './form-result';
import { registrationLogistics } from './registration-logistics';
import { registrationChanges } from './registration-changes';
import { audit, digest, eligible, type Transaction } from './registration';
import { notifyRegistration } from './registration-workflow';

export function registrationVersion(entry: { starts: string; ends: string; status: string; details: unknown }) {
  return digest(JSON.stringify([entry.starts,entry.ends,entry.status,entry.details]));
}

// Caller locks the outing first and authorizes the coordinator for its current unit.
export async function editStaffRegistration(tx: Transaction, id: string, actor: string, version: string,
  starts: string, ends: string, details: Record<string,string | boolean | number>): Promise<FormResult> {
  const [entry] = await tx`select *,starts::text,ends::text from registrations where id=${id} for update`;
  if (!entry || !registrationIsActive(entry.status)) return { error: 'Solo se pueden editar inscripciones activas.' };
  const [outing] = await tx`select unit,status,flexible,starts::text,ends::text from outings where id=${entry.outing_id}`;
  if (!outing || !outingIsOpen(outing.status)) return { error: 'La salida debe estar abierta o confirmada.' };
  if (version !== registrationVersion(entry as {starts:string;ends:string;status:string;details:unknown})) return { error: 'La inscripción cambió. Cerrá el modal y volvé a abrirlo para revisar los datos actuales.' };
  const fieldErrors=validateRegistrationData(starts,ends,details,{flexible:outing.flexible,starts:outing.starts,ends:outing.ends});
  if(Object.keys(fieldErrors).length)return {fieldErrors};
  if (!await eligible(tx,entry.volunteer_id,outing.unit)) return { error: 'La persona no pertenece a la unidad de esta salida.' };
  const policy=await registrationCoverage(tx,entry.volunteer_id,starts,ends);
  if (!policy) return { error: 'No encontramos una póliza vigente para todas las fechas de participación.' };
  const changedDates = starts !== entry.starts || ends !== entry.ends;
  const decision=editRegistrationTransition(entry.status,changedDates,'staff');
  const status=decision.status;
  const updated = { ...entry.details,...details };
  if (status !== 'confirmada') delete updated.assigned70;
  if(!changedDates&&status===entry.status&&entry.policy_id===policy.id&&JSON.stringify(registrationLogistics(entry.details))===JSON.stringify(registrationLogistics(updated))&&(entry.details?.assigned70===true)===(updated.assigned70===true))return {saved:true};
  await tx`update registrations set starts=${starts},ends=${ends},status=${status},policy_id=${policy.id},details=${tx.json(updated)} where id=${id}`;
  if (status !== 'confirmada') await tx`update outing_brief_links set revoked_at=now() where lead_registration_id=${id} and revoked_at is null`;
  await audit(tx,actor,decision.audit,id,registrationChanges({starts:entry.starts,ends:entry.ends,status:entry.status,details:entry.details},{starts,ends,status,details:updated}));
  await notifyRegistration(tx,id,decision.message);
  return { saved: true };
}
