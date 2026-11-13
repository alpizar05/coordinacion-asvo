export type ParticipationRow = {
  id:string; outing_id:string; title:string; unit:string; starts:string; ends:string;
  outing_start:string; outing_end:string; status:string; outing_status:string; flexible:boolean;
  historical_participation?: string | null;
  resolution?:string | null; resolution_stale?:boolean; assigned70:boolean; lead_report:boolean; pending_report:boolean; attended:boolean; absent:boolean;
};
export function participationResult(row: ParticipationRow) {
  if (row.attended && row.absent) return 'Asistencia por conciliar';
  if (row.resolution === 'participo') return 'Participación confirmada · Conciliada';
  if (row.resolution === 'no_participo') return 'No participó · Conciliado';
  if (row.attended) return 'Participación confirmada';
  if (row.absent) return 'No participó según informe';
  if (row.outing_status === 'cancelada') return 'Salida cancelada';
  if (row.status.startsWith('cancelada')) return 'Inscripción cancelada';
  if (row.status === 'rechazada') return 'Inscripción rechazada';
  if (row.status === 'espera') return 'En lista de espera';
  if (row.status === 'revisión' || row.status === 'validación') return 'Inscripción pendiente';
  if (row.historical_participation === 'completada') return 'Participación registrada · Histórico';
  if (row.historical_participation === 'completada_asumida_demo') return 'Participación asumida · Demo';
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
