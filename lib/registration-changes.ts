import { registrationLogistics } from './registration-logistics';

type Snapshot = { starts: string; ends: string; status: string; details: Record<string,unknown> | null };
export function registrationChanges(before: Snapshot, after: Snapshot) {
  const previous = registrationLogistics(before.details), next = registrationLogistics(after.details);
  const yes = (value: boolean) => value ? 'Sí' : 'No';
  const fields = [
    ['Llegada',before.starts,after.starts],['Regreso',before.ends,after.ends],['Estado',before.status,after.status],
    ['Transporte propio',yes(previous.transport),yes(next.transport)],
    ['Personas que puede llevar',previous.legacySeats ? 'Cantidad no indicada' : String(previous.seats),next.legacySeats ? 'Cantidad no indicada' : String(next.seats)],
    ['Restricciones alimentarias',previous.food,next.food],['Interés en ser 70',yes(previous.interested70),yes(next.interested70)],
    ['Observaciones',previous.other,next.other],['Asignación de 70',yes(before.details?.assigned70 === true),yes(after.details?.assigned70 === true)],
  ];
  return fields.filter(([,old,value])=>old!==value).map(([label,old,value])=>`${label}: «${old || 'Sin indicar'}» → «${value || 'Sin indicar'}»`).join('\n') || 'Sin cambios en los campos de participación.';
}
