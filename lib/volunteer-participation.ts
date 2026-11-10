import { sql } from './db';
import { registrationToday } from './outing-invitations';

export type ParticipationRow = {
  id:string; outing_id:string; title:string; unit:string; starts:string; ends:string;
  outing_start:string; outing_end:string; status:string; outing_status:string; flexible:boolean;
  assigned70:boolean; lead_report:boolean; pending_report:boolean; attended:boolean; absent:boolean;
};
export function participationResult(row: ParticipationRow) {
  if (row.attended && row.absent) return 'Asistencia por conciliar';
  if (row.attended) return 'Participación confirmada';
  if (row.absent) return 'No participó según informe';
  if (row.outing_status === 'cancelada') return 'Salida cancelada';
  if (row.status.startsWith('cancelada')) return 'Inscripción cancelada';
  if (row.status === 'rechazada') return 'Inscripción rechazada';
  if (row.status === 'espera') return 'En lista de espera';
  if (row.status === 'revisión' || row.status === 'validación') return 'Inscripción pendiente';
  return 'Asistencia pendiente de confirmar';
}
export function participationSummary(rows: ParticipationRow[]) {
  const confirmed = rows.filter(row => row.attended && !row.absent);
  const last = [...confirmed].sort((a,b)=>b.outing_start.localeCompare(a.outing_start) || b.outing_id.localeCompare(a.outing_id))[0];
  return {
    attended: new Set(confirmed.map(row=>row.outing_id)).size,
    lead: new Set(rows.filter(row=>row.lead_report).map(row=>row.outing_id)).size,
    pending: new Set(rows.filter(row=>row.pending_report).map(row=>row.outing_id)).size,
    conflicts: new Set(rows.filter(row=>row.attended && row.absent).map(row=>row.outing_id)).size,
    last,
  };
}
export async function volunteerParticipations(volunteerId: string) {
  return sql<ParticipationRow[]>`
    with evidence as (
      select p.outing_id,bool_or(member.value->'attended'='true'::jsonb) as attended,
        bool_or(member.value->'attended'='false'::jsonb) as absent
      from outing_reports p cross join lateral jsonb_array_elements(p.participants) member(value)
      join registrations participant on participant.id::text=member.value->>'id' and participant.outing_id=p.outing_id
      where p.status='finalizado' and participant.volunteer_id=${volunteerId}
      group by p.outing_id
    )
    select r.id,r.outing_id,o.title,o.unit,r.starts::text,r.ends::text,o.starts::text as outing_start,o.ends::text as outing_end,
      r.status,o.status as outing_status,o.flexible,
      (r.status='confirmada' and r.details->'assigned70'='true'::jsonb) is true as assigned70,
      exists(select 1 from outing_reports p join registrations lead on lead.id=p.lead_registration_id
        where p.outing_id=o.id and lead.volunteer_id=${volunteerId} and p.status='finalizado') as lead_report,
      (o.ends<${registrationToday} and o.status in ('abierta','confirmada','completada') and r.status='confirmada'
        and r.details->'assigned70'='true'::jsonb and not exists(select 1 from outing_reports p
          where p.outing_id=o.id and p.lead_registration_id=r.id and p.status='finalizado')) is true as pending_report,
      coalesce(e.attended,false) as attended,coalesce(e.absent,false) as absent
    from registrations r join outings o on o.id=r.outing_id left join evidence e on e.outing_id=o.id
    where r.volunteer_id=${volunteerId} order by o.starts desc,r.received_at desc,r.id`;
}
