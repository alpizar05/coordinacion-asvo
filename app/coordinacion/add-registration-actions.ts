'use server';

import { revalidatePath } from 'next/cache';
import { allows, staff } from '../../lib/auth';
import { sql } from '../../lib/db';
import { field, uuid } from '../../lib/registration';
import { searchVolunteers } from '../../lib/volunteer-search';
import { receiveStaffRegistration } from '../../lib/staff-registration';
import { validateStaffParticipation } from '../../lib/staff-registration-validation';
import { registrationDetails } from '../../lib/registration-validation';
import type { FormResult } from '../../lib/form-result';
import { dispatchRegistrationUpdates } from '../../lib/registration-workflow';

export async function findRegistrationVolunteers(outingId: string, query: string) {
  const user = await staff();
  if (!uuid(outingId)) return { error: 'Salida inválida.', people: [] };
  const [outing] = await sql`select unit from outings where id=${outingId}`;
  if (!outing || !allows(user,'registrations.add',{unit:outing.unit})) return { error: 'No tenés permiso para gestionar esta salida.', people: [] };
  if (query.trim().length < 2) return { people: [] };
  const result = await searchVolunteers(query,outing.unit === 'Voluntariado General' ? '' : outing.unit,1);
  return { people: result.people.map(person => ({ id: person.id, name: [person.name,person.surname,person.second_surname].filter(Boolean).join(' '), identification: person.identification })), total: result.total };
}

export async function addRegistration(outingId: string, form: FormData): Promise<FormResult & {status?:string}> {
  const user = await staff();
  const volunteerId = field(form,'volunteer');
  if (!uuid(outingId)) return {error:'La salida no está disponible.'};
  const result = await sql.begin(async tx => {
    const [outing] = await tx`select id,unit,status,flexible,starts::text as first_day,ends::text as last_day from outings where id=${outingId} for update`;
    if (!outing || !user || !allows(user,'registrations.add',{unit:outing.unit})) return { error: 'No tenés permiso para gestionar esta salida.' };
    if (field(form,'schedule') !== `${outing.first_day}/${outing.last_day}/${outing.flexible}`) return { error: 'Las fechas de la salida cambiaron. Cerrá el modal y actualizá la página antes de continuar.' };
    const fieldErrors=validateStaffParticipation(form,{flexible:outing.flexible,starts:outing.first_day,ends:outing.last_day},true);
    if(Object.keys(fieldErrors).length)return {fieldErrors};
    return receiveStaffRegistration(tx,outing as {id:string;unit:string;status:string;flexible:boolean;first_day:string;last_day:string},user.subject,volunteerId,field(form,'starts'),field(form,'ends'),registrationDetails(form,outing.unit==='Voluntariado General'));
  });
  if (result.saved) {
    await dispatchRegistrationUpdates();
    revalidatePath(`/coordinacion/salidas/${outingId}`);
    revalidatePath('/coordinacion/inscripciones');
    revalidatePath('/');
  }
  return result;
}
