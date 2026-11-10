import { audit, date, digest, eligible, type Transaction } from './registration';
import { notifyRegistration } from './registration-workflow';

export function registrationVersion(entry: { starts: string; ends: string; status: string; details: unknown }) {
  return digest(JSON.stringify([entry.starts,entry.ends,entry.status,entry.details]));
}

// Caller locks the outing first and authorizes the coordinator for its current unit.
export async function editStaffRegistration(tx: Transaction, id: string, actor: string, version: string,
  starts: string, ends: string, details: Record<string,string | boolean | number>) {
  const [entry] = await tx`select *,starts::text,ends::text from registrations where id=${id} for update`;
  if (!entry || !['revisión','espera','confirmada'].includes(entry.status)) return { error: 'Solo se pueden editar inscripciones activas.' };
  const [outing] = await tx`select unit,status,flexible,starts::text,ends::text from outings where id=${entry.outing_id}`;
  if (!outing || !['abierta','confirmada'].includes(outing.status)) return { error: 'La salida debe estar abierta o confirmada.' };
  if (version !== registrationVersion(entry as {starts:string;ends:string;status:string;details:unknown})) return { error: 'La inscripción cambió. Cerrá el modal y volvé a abrirlo para revisar los datos actuales.' };
  if (!date(starts) || !date(ends) || ends < starts || starts > outing.ends || ends < outing.starts ||
    (!outing.flexible && (starts !== outing.starts || ends !== outing.ends))) return { error: 'Revisá las fechas: deben coincidir con la salida o intersectar su periodo si es flexible.' };
  if (!await eligible(tx,entry.volunteer_id,outing.unit)) return { error: 'La persona no pertenece a la unidad de esta salida.' };
  const [policy] = await tx`select id from policies where volunteer_id=${entry.volunteer_id} and verified_at is not null
    and starts<=${starts}::date and ends>=${ends}::date limit 1`;
  if (!policy) return { error: 'No encontramos una póliza vigente para todas las fechas de participación.' };
  const changedDates = starts !== entry.starts || ends !== entry.ends;
  const status = entry.status === 'confirmada' && changedDates ? 'revisión' : entry.status;
  const updated = { ...entry.details,...details };
  if (status !== 'confirmada') delete updated.assigned70;
  await tx`update registrations set starts=${starts},ends=${ends},status=${status},policy_id=${policy.id},details=${tx.json(updated)} where id=${id}`;
  if (status !== 'confirmada') await tx`update outing_brief_links set revoked_at=now() where lead_registration_id=${id} and revoked_at is null`;
  await audit(tx,actor,'Editó inscripción desde Coordinación',id,changedDates ? `Fechas: ${entry.starts} al ${entry.ends} → ${starts} al ${ends}` : 'Actualizó datos de participación');
  await notifyRegistration(tx,id,changedDates && entry.status === 'confirmada'
    ? 'Coordinación actualizó tus fechas de participación. Conservás el cupo reservado; las fechas nuevas están en revisión.'
    : 'Coordinación actualizó los datos de tu inscripción. Podés consultar el detalle en tu enlace privado.');
  return { saved: true };
}
