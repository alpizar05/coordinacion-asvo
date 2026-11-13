'use server';

import { revalidatePath } from 'next/cache';
import { allows, staff } from '../../lib/auth';
import { sql } from '../../lib/db';
import { field, uuid } from '../../lib/registration';
import { registrationLogistics } from '../../lib/registration-logistics';
import { editStaffRegistration, registrationVersion } from '../../lib/edit-registration';
import { validateStaffParticipation } from '../../lib/staff-registration-validation';
import { registrationDetails } from '../../lib/registration-validation';
import type { FormResult } from '../../lib/form-result';
import { dispatchRegistrationUpdates } from '../../lib/registration-workflow';

export async function loadEditableRegistration(id: string) {
  const user = await staff();
  if (!uuid(id)) return { error: 'Inscripción inválida.' };
  const [entry] = await sql`select r.starts::text,r.ends::text,r.status,r.details,o.unit,o.flexible,o.starts::text as first_day,o.ends::text as last_day,o.status as outing_status,
    concat_ws(' ',v.name,v.surname,v.second_surname) as name from registrations r join outings o on o.id=r.outing_id
    join volunteers v on v.id=r.volunteer_id where r.id=${id}`;
  if (!entry || !allows(user,'registrations.manage',{unit:entry.unit})) return { error: 'No tenés permiso para editar esta inscripción.' };
  if (!['revisión','espera','confirmada'].includes(entry.status) || !['abierta','confirmada'].includes(entry.outing_status)) return { error: 'Esta inscripción no se puede editar en su estado actual.' };
  return { data: { name: String(entry.name),starts: String(entry.starts),ends: String(entry.ends),
    firstDay:String(entry.first_day),lastDay:String(entry.last_day),flexible: !!entry.flexible,general: entry.unit === 'Voluntariado General',confirmed: entry.status === 'confirmada',
    version: registrationVersion(entry as {starts:string;ends:string;status:string;details:unknown}),...registrationLogistics(entry.details) } };
}

export async function saveEditedRegistration(id: string, form: FormData): Promise<FormResult> {
  const user = await staff();
  if (!uuid(id)) return { error: 'Inscripción inválida.' };
  const result = await sql.begin(async tx => {
    const [parent] = await tx`select outing_id from registrations where id=${id}`;
    if (!parent) return { error: 'Inscripción no encontrada.' };
    const [outing] = await tx`select id,unit,flexible,starts::text as first_day,ends::text as last_day from outings where id=${parent.outing_id} for update`;
    if (!outing || !user || !allows(user,'registrations.manage',{unit:outing.unit})) return { error: 'No tenés permiso para editar esta inscripción.' };
    // A grouping may have moved the registration while waiting for the outing lock.
    const [current] = await tx`select outing_id,starts::text,ends::text,status,details from registrations where id=${id} for update`;
    if (!current || current.outing_id !== outing.id) return { error: 'La inscripción cambió de salida. Cerrá el modal y volvé a abrirlo.' };
    if(field(form,'version')!==registrationVersion(current as {starts:string;ends:string;status:string;details:unknown}))return {error:'La inscripción cambió. Cerrá el modal y volvé a abrirlo para revisar los datos actuales.'};
    const fieldErrors=validateStaffParticipation(form,{flexible:outing.flexible,starts:outing.first_day,ends:outing.last_day});
    if(Object.keys(fieldErrors).length)return {fieldErrors};
    return editStaffRegistration(tx,id,user.subject,field(form,'version'),field(form,'starts'),field(form,'ends'),registrationDetails(form,outing.unit==='Voluntariado General'));
  });
  if (result.saved) { await dispatchRegistrationUpdates(); revalidatePath('/coordinacion','layout'); revalidatePath('/'); }
  return result;
}
