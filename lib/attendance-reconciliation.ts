import {validateRegistryForm} from './registry-validation';
import type {FormResult} from './form-result';
import { sql } from './db';
import { audit, type Transaction } from './registration';

export const attendanceDecisionLabels = { participo:'Participó',no_participo:'No participó',pendiente:'Mantener pendiente' } as const;
export type AttendanceDecision = keyof typeof attendanceDecisionLabels;
export async function attendanceCases(outingId: string, tx?: Transaction) {
  const db = tx || sql;
  return db`with evidence as (
    select e.volunteer_id,bool_or(e.attended) as attended,bool_or(e.absent) as absent,
      jsonb_agg(e.evidence_entry order by e.report_id) as snapshot,
      jsonb_agg(jsonb_build_object('id',e.report_id,'lead',e.lead_name,'starts',e.starts::text,'ends',e.ends::text,
        'observations',e.observations,'submitted',e.submitted_at,'attended',e.attended,'absent',e.absent) order by e.submitted_at,e.report_id) as reports
    from volunteer_attendance_evidence e where e.outing_id=${outingId} group by e.volunteer_id
  ) select e.*,concat_ws(' ',v.name,v.surname,v.second_surname) as name,
    md5(e.snapshot::text) as version,q.id as resolution_id,q.decision,q.reason,q.actor,q.created_at,
    coalesce(attendance_resolution_is_current(q.decision,q.evidence,e.snapshot),false) as current_resolution,
    (select jsonb_agg(jsonb_build_object('starts',r.starts::text,'ends',r.ends::text) order by r.received_at) from registrations r
      where r.outing_id=${outingId} and r.volunteer_id=e.volunteer_id) as dates,
    coalesce((select jsonb_agg(jsonb_build_object('decision',h.decision,'reason',h.reason,'actor',h.actor,'created',h.created_at) order by h.id desc)
      from attendance_resolutions h where h.outing_id=${outingId} and h.volunteer_id=e.volunteer_id),'[]'::jsonb) as history
    from evidence e join volunteers v on v.id=e.volunteer_id
    left join lateral(select * from attendance_resolutions where outing_id=${outingId} and volunteer_id=e.volunteer_id order by id desc limit 1) q on true
    where (e.attended and e.absent) or q.id is not null order by v.name,v.surname,v.id`;
}

// Caller locks the outing and verifies Coordination's permission for its current unit.
export async function saveAttendanceResolution(tx: Transaction, outingId: string, volunteerId: string, version: string, decision: string, reason: string, actor: string):Promise<FormResult> {

  const [outing] = await tx`select status from outings where id=${outingId}`;
  if (!outing || !['abierta','confirmada','completada'].includes(outing.status)) return { error:'La salida no permite conciliar asistencia.' };
  const item = (await attendanceCases(outingId,tx)).find(row=>row.volunteer_id===volunteerId);
  if (!item || item.version !== version) return { error:'Los informes cambiaron. Cerrá el modal y volvé a revisar las versiones actuales.' };
  const form=new FormData();form.set('decision',decision);form.set('reason',reason);
  const errors=validateRegistryForm(form,'attendance');if(Object.keys(errors).length)return {fieldErrors:errors};
  if(item.current_resolution&&item.decision===decision&&item.reason===reason.trim())return {saved:true};
  await tx`insert into attendance_resolutions(outing_id,volunteer_id,decision,reason,actor,evidence)
    values (${outingId},${volunteerId},${decision},${reason.trim()},${actor},${tx.json(item.snapshot)})`;
  const message = `${attendanceDecisionLabels[decision as AttendanceDecision]} · ${reason.trim()}`;
  await audit(tx,actor,'Concilió asistencia de salida',outingId,`${item.name}: ${message}`);
  const registrations = await tx`select id from registrations where outing_id=${outingId} and volunteer_id=${volunteerId}`;
  for (const entry of registrations) await audit(tx,actor,'Concilió asistencia',entry.id,message);
  return { saved:true };
}
