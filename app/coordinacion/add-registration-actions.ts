'use server';

import { revalidatePath } from 'next/cache';
import { canOperate, staff } from '../../lib/auth';
import { sql } from '../../lib/db';
import { field, uuid } from '../../lib/registration';
import { searchVolunteers } from '../../lib/volunteer-search';
import { receiveStaffRegistration } from '../../lib/staff-registration';
import { dispatchRegistrationUpdates } from '../../lib/registration-workflow';

export async function findRegistrationVolunteers(outingId: string, query: string) {
  const user = await staff();
  if (!uuid(outingId)) return { error: 'Salida inválida.', people: [] };
  const [outing] = await sql`select unit from outings where id=${outingId}`;
  if (!outing || !canOperate(user,outing.unit)) return { error: 'No tenés permiso para gestionar esta salida.', people: [] };
  if (query.trim().length < 2) return { people: [] };
  const result = await searchVolunteers(query,outing.unit === 'Voluntariado General' ? '' : outing.unit,1);
  return { people: result.people.map(person => ({ id: person.id, name: [person.name,person.surname,person.second_surname].filter(Boolean).join(' '), identification: person.identification })), total: result.total };
}

export async function addRegistration(outingId: string, form: FormData) {
  const user = await staff();
  const volunteerId = field(form,'volunteer');
  if (!uuid(outingId) || !uuid(volunteerId)) return { error: 'Seleccioná una persona del registro.' };
  const rides = Number(field(form,'rides'));
  if (!Number.isSafeInteger(rides) || rides < 0 || rides > 100) return { error: 'Ingresá entre 0 y 100 personas para el transporte.' };
  const result = await sql.begin(async tx => {
    const [outing] = await tx`select id,unit,status,flexible,starts::text as first_day,ends::text as last_day from outings where id=${outingId} for update`;
    if (!outing || !user || !canOperate(user,outing.unit)) return { error: 'No tenés permiso para gestionar esta salida.' };
    if (field(form,'schedule') !== `${outing.first_day}/${outing.last_day}/${outing.flexible}`) return { error: 'Las fechas de la salida cambiaron. Cerrá el modal y actualizá la página antes de continuar.' };
    return receiveStaffRegistration(tx,outing as {id:string;unit:string;status:string;flexible:boolean;first_day:string;last_day:string},user.subject,volunteerId,field(form,'starts'),field(form,'ends'),{
      transporte: field(form,'transport') === 'on', ofreceTransporte: field(form,'transport') === 'on' ? rides : 0,
      alimentacion: field(form,'food').slice(0,500), otro: field(form,'other').slice(0,500),
      interes70: outing.unit === 'Voluntariado General' && field(form,'lead') === 'on',
    });
  });
  if ('saved' in result) {
    await dispatchRegistrationUpdates();
    revalidatePath(`/coordinacion/salidas/${outingId}`);
    revalidatePath('/coordinacion/inscripciones');
    revalidatePath('/');
  }
  return result;
}
