

export async function outingUnitHasConflict(tx: import('./registration').Transaction, ids: string[], unit: string) {
  if (unit === 'Voluntariado General' || !ids.length) return false;
  const [conflict] = await tx`select 1 from registrations r left join volunteers v on v.id=r.volunteer_id
    where r.outing_id=any(${ids}::uuid[]) and r.status in ('validación','revisión','espera','confirmada')
    and (v.id is null or not (${unit}=any(v.units))) limit 1`;
  return !!conflict;
}
