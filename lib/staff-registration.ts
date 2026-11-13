import {outingIsOpen} from './workflow-transitions';
import {registrationCoverage} from './registration-coverage';
import {validateRegistrationData} from './registration-validation';
import type { FormResult } from './form-result';
import { audit, eligible, type Transaction } from './registration';
import { receiveRegistration } from './registration-workflow';

// Caller locks the outing and verifies the coordinator's permission for its unit.
export async function receiveStaffRegistration(tx: Transaction, outing: {
  id: string; status: string; first_day: string; last_day: string; flexible: boolean; unit: string;
}, actor: string, volunteerId: string, starts: string, ends: string, details: Record<string,string | boolean | number>): Promise<FormResult<string,{id:string;status:string}>> {
  if (!outingIsOpen(outing.status)) return { error: 'La salida debe estar abierta o confirmada.' };
  const fieldErrors=validateRegistrationData(starts,ends,details,{flexible:outing.flexible,starts:outing.first_day,ends:outing.last_day});
  if(Object.keys(fieldErrors).length)return {fieldErrors};
  const [person] = await tx`select id,identification,email from volunteers where id=${volunteerId} for share`;
  if (!person) return { fieldErrors: {volunteer:'La persona seleccionada ya no está disponible. Buscala nuevamente.'}, error: 'Seleccioná una persona del registro de voluntariado.' };
  if (!person.email) return { error: 'La persona no tiene correo registrado. Administración debe actualizar su ficha.' };
  if (!await eligible(tx,person.id,outing.unit)) return { error: 'La persona no pertenece a la unidad de esta salida.' };
  const coverage=await registrationCoverage(tx,person.id,starts,ends);
  if (!coverage) return { error: 'No encontramos una póliza vigente que cubra todas las fechas de participación.' };
  const result = await receiveRegistration(tx,{ outingId: outing.id, volunteerId: person.id,
    actor, identification: person.identification, starts, ends, details });
  if (result.duplicate) return { error: 'La persona ya tiene una inscripción activa en esta salida.' };
  await audit(tx,actor,'Agregó inscripción desde Coordinación',result.id,result.status);
  return { saved: true, status: result.status, id: result.id };
}
