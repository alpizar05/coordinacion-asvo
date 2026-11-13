'use server';

import { allows, staff } from '../../lib/auth';
import { sql } from '../../lib/db';
import { uuid } from '../../lib/registration';
import { registrationHistory } from '../../lib/registration-history';

export async function loadRegistrationDetail(id: string) {
  const user = await staff();
  if (!uuid(id)) return { error: 'Inscripción inválida.' };
  const [row] = await sql`select r.id,r.identification,r.status,r.starts::text,r.ends::text,r.received_at,r.details,
    o.unit,concat_ws(' ',v.name,v.surname,v.second_surname) as volunteer,
    exists(select 1 from policies p where p.volunteer_id=r.volunteer_id and p.verified_at is not null and p.starts<=r.starts and p.ends>=r.ends) as covered
    from registrations r join outings o on o.id=r.outing_id left join volunteers v on v.id=r.volunteer_id where r.id=${id}`;
  if (!row || !allows(user,'registrations.read',{unit:row.unit})) return { error: 'No tenés permiso para consultar esta inscripción.' };
  const history = await registrationHistory(id);
  return { data: { entry: { volunteer:String(row.volunteer || 'Ficha pendiente de conciliar'),identification:String(row.identification),
    status:String(row.status),starts:String(row.starts),ends:String(row.ends),received:row.received_at?.toISOString() ?? null,
    covered:!!row.covered,assigned70:row.status === 'confirmada' && row.details?.assigned70 === true,details:row.details as Record<string,unknown>|null },
    general:row.unit === 'Voluntariado General',history } };
}
