import { audit, date, eligible, type Transaction } from './registration';
import { receiveRegistration } from './registration-workflow';

// Caller locks the outing and verifies the coordinator's permission for its unit.
export async function receiveStaffRegistration(tx: Transaction, outing: {
  id: string; status: string; first_day: string; last_day: string; flexible: boolean; unit: string;
}, actor: string, volunteerId: string, starts: string, ends: string, details: Record<string,string | boolean | number>) {
  if (!['abierta','confirmada'].includes(outing.status)) return { error: 'La salida debe estar abierta o confirmada.' };
  if (!date(starts) || !date(ends) || ends < starts || starts > outing.last_day || ends < outing.first_day ||
    (!outing.flexible && (starts !== outing.first_day || ends !== outing.last_day))) {
    return { error: 'Revisá las fechas de participación. Deben coincidir con la salida o, si es flexible, intersectar su periodo.' };
  }
  const [person] = await tx`select id,identification,email from volunteers where id=${volunteerId} for share`;
  if (!person) return { error: 'Seleccioná una persona del registro de voluntariado.' };
  if (!person.email) return { error: 'La persona no tiene correo registrado. Administración debe actualizar su ficha.' };
  if (!await eligible(tx,person.id,outing.unit)) return { error: 'La persona no pertenece a la unidad de esta salida.' };
  const [coverage] = await tx`select id from policies where volunteer_id=${person.id} and verified_at is not null
    and starts<=${starts}::date and ends>=${ends}::date limit 1`;
  if (!coverage) return { error: 'No encontramos una póliza vigente que cubra todas las fechas de participación.' };
  const result = await receiveRegistration(tx,{ outingId: outing.id, volunteerId: person.id,
    actor, identification: person.identification, starts, ends, details });
  if (result.duplicate) return { error: 'La persona ya tiene una inscripción activa en esta salida.' };
  await audit(tx,actor,'Agregó inscripción desde Coordinación',result.id,result.status);
  return { saved: true, status: result.status, id: result.id };
}
