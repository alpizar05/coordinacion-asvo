'use server';

import { revalidatePath } from 'next/cache';
import { canOperate, staff } from '../../lib/auth';
import { sql } from '../../lib/db';
import { field, uuid } from '../../lib/registration';
import { registrationLogistics } from '../../lib/registration-logistics';
import { editStaffRegistration, registrationVersion } from '../../lib/edit-registration';
import { dispatchRegistrationUpdates } from '../../lib/registration-workflow';

export async function loadEditableRegistration(id: string) {
  const user = await staff();
  if (!uuid(id)) return { error: 'Inscripción inválida.' };
  const [entry] = await sql`select r.starts::text,r.ends::text,r.status,r.details,o.unit,o.flexible,o.status as outing_status,
    concat_ws(' ',v.name,v.surname,v.second_surname) as name from registrations r join outings o on o.id=r.outing_id
    join volunteers v on v.id=r.volunteer_id where r.id=${id}`;
  if (!entry || !canOperate(user,entry.unit)) return { error: 'No tenés permiso para editar esta inscripción.' };
  if (!['revisión','espera','confirmada'].includes(entry.status) || !['abierta','confirmada'].includes(entry.outing_status)) return { error: 'Esta inscripción no se puede editar en su estado actual.' };
  return { data: { name: String(entry.name),starts: String(entry.starts),ends: String(entry.ends),
    flexible: !!entry.flexible,general: entry.unit === 'Voluntariado General',confirmed: entry.status === 'confirmada',
    version: registrationVersion(entry as {starts:string;ends:string;status:string;details:unknown}),...registrationLogistics(entry.details) } };
}

export async function saveEditedRegistration(id: string, form: FormData) {
  const user = await staff();
  if (!uuid(id)) return { error: 'Inscripción inválida.' };
  const rides = Number(field(form,'rides'));
  if (!Number.isSafeInteger(rides) || rides < 0 || rides > 100) return { error: 'Ingresá entre 0 y 100 personas para transporte.' };
  const result = await sql.begin(async tx => {
    const [parent] = await tx`select outing_id from registrations where id=${id}`;
    if (!parent) return { error: 'Inscripción no encontrada.' };
    const [outing] = await tx`select id,unit from outings where id=${parent.outing_id} for update`;
    if (!outing || !user || !canOperate(user,outing.unit)) return { error: 'No tenés permiso para editar esta inscripción.' };
    // A grouping may have moved the registration while waiting for the outing lock.
    const [current] = await tx`select outing_id from registrations where id=${id} for update`;
    if (!current || current.outing_id !== outing.id) return { error: 'La inscripción cambió de salida. Cerrá el modal y volvé a abrirlo.' };
    return editStaffRegistration(tx,id,user.subject,field(form,'version'),field(form,'starts'),field(form,'ends'),{
      transporte: field(form,'transport') === 'on', ofreceTransporte: field(form,'transport') === 'on' ? rides : 0,
      alimentacion: field(form,'food').slice(0,500),otro: field(form,'other').slice(0,500),
      interes70: outing.unit === 'Voluntariado General' && field(form,'lead') === 'on',
    });
  });
  if (result.saved) { await dispatchRegistrationUpdates(); revalidatePath('/coordinacion','layout'); revalidatePath('/'); }
  return result;
}
