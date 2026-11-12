import { labourOptions, activityOptions } from './outing-report-options';
import { sql } from './db';
import { audit, date, digest, type Transaction } from './registration';

export type ReportParticipant = { id: string; name: string; attended: boolean };
export type OutingReport = {
  id: string; outing_id: string; lead_registration_id: string; lead_name: string; lead_email: string;
  labour: string; labour_types: string[]; location: string; activity: string; starts: string; ends: string; actions: string;
  host: string; observations: string; participants: ReportParticipant[]; status: 'borrador' | 'finalizado'; submitted_at: Date | null; updated_at: Date;
};
export {validateReport} from './outing-report-validation';
export type {ReportValues,ReportErrors} from './outing-report-validation';
import {validateReport,type ReportValues} from './outing-report-validation';

export async function readOutingReports(outingId: string) {
  return sql<OutingReport[]>`select *,coalesce(starts::text,'') as starts,coalesce(ends::text,'') as ends from outing_reports where outing_id=${outingId} order by submitted_at desc`;
}


export async function saveOutingReport(tx: Transaction, token: string, values: ReportValues, attended: string[], accuracy: boolean, expectedRoster: string[], mode: 'borrador' | 'finalizar' = 'finalizar', expectedVersion?:string) {
  const general=(message:string,legacy:'form'|'participants'|'email'='form')=>({error:message,errors:{[legacy]:message}});
  if (!/^[\w-]{43}$/.test(token)) return general('El enlace no es válido.','form');
  const [ref] = await tx`select outing_id from outing_brief_links where digest=${digest(token)}`;
  if (!ref) return general('El enlace no está disponible.','form');
  await tx`select id from outings where id=${ref.outing_id} for update`;
  const [access] = await tx`select l.outing_id,l.lead_registration_id,
    concat_ws(' ',v.name,v.surname,v.second_surname) as name,v.email
    from outing_brief_links l join registrations r on r.id=l.lead_registration_id and r.outing_id=l.outing_id
    join volunteers v on v.id=r.volunteer_id join outings o on o.id=l.outing_id
    where l.digest=${digest(token)} and l.revoked_at is null and l.expires_at>clock_timestamp()
      and r.status='confirmada' and r.details->'assigned70'='true'::jsonb
      and o.status in ('abierta','confirmada','completada') for update of l`;
  if (!access) return general('El enlace venció, fue revocado o cambió tu asignación de 70. Contactá a Coordinación.','form');
  if (!access.email) return general('Tu ficha no tiene correo electrónico. Contactá a Coordinación para actualizarla.','email');
  const [existing] = await tx`select status,updated_at from outing_reports where outing_id=${access.outing_id} and lead_registration_id=${access.lead_registration_id} for update`;
  if (existing?.status === 'finalizado') return general('El informe ya fue finalizado y no se puede editar.','form');
  const roster = await tx<{ id: string; name: string }[]>`select r.id,concat_ws(' ',v.name,v.surname,v.second_surname) as name
    from registrations r join volunteers v on v.id=r.volunteer_id where r.outing_id=${access.outing_id} and r.status='confirmada' order by v.name,v.surname`;
  if (mode === 'finalizar' && (expectedRoster.length !== roster.length || roster.some(person => !expectedRoster.includes(person.id)))) return general('La lista de participantes cambió. Recargá la página y revisá la asistencia antes de enviar.','participants');
  if (mode === 'finalizar' && attended.some(id => !roster.some(person => person.id === id))) return general('La lista de participantes cambió. Recargá la página y revisá la asistencia antes de enviar.','participants');
  if(expectedVersion!==undefined&&expectedVersion!==(existing?new Date(existing.updated_at).toISOString():'new'))return general('El borrador cambió desde que abriste el formulario. Recargá antes de guardar.');
  const errors=validateReport(values,attended,accuracy,mode==='borrador');if(Object.keys(errors).length)return {errors};
  const participants = roster.map(person => ({ ...person, attended: attended.includes(person.id) }));
  const [report] = await tx`insert into outing_reports(outing_id,lead_registration_id,lead_name,lead_email,labour,labour_types,location,activity,starts,ends,actions,host,observations,participants,status,submitted_at)
    values (${access.outing_id},${access.lead_registration_id},${access.name},${access.email},${Array.from(new Set(values.labour)).join(', ')},${Array.from(new Set(values.labour))},${values.location.trim()},${values.activity.trim()},${values.starts || null},${values.ends || null},${values.actions.trim()},${values.host.trim()},${values.observations.trim()},${tx.json(participants)},${mode === 'borrador' ? 'borrador' : 'finalizado'},case when ${mode === 'finalizar'} then clock_timestamp() else null end)
    on conflict (outing_id,lead_registration_id) do update set lead_name=excluded.lead_name,lead_email=excluded.lead_email,
      labour=excluded.labour,labour_types=excluded.labour_types,location=excluded.location,activity=excluded.activity,starts=excluded.starts,ends=excluded.ends,
      actions=excluded.actions,host=excluded.host,observations=excluded.observations,participants=excluded.participants,status=excluded.status,submitted_at=excluded.submitted_at,updated_at=clock_timestamp()
    where outing_reports.status='borrador'
    returning id`;
  if (!report) return general('El informe ya fue finalizado y no se puede editar.','form');
  await audit(tx,`70:${access.lead_registration_id}`,mode === 'borrador' ? 'Guardó borrador de informe' : 'Finalizó informe de salida',access.outing_id,`Informe: ${report.id}`);
  return { id: String(report.id), status: mode === 'borrador' ? 'borrador' : 'finalizado' };
}
