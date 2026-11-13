import {allows} from "./auth";
import {searchVolunteers} from "./volunteer-search";
import {registrationLogistics} from "./registration-logistics";
import {registrationVersion} from "./edit-registration";
import {registrationHistory} from "./registration-history";

export async function findStaffRegistrationVolunteers(connection:import("postgres").Sql,user:import("./authorization").StaffPrincipal,outingId:string,query:string){
  const [outing] = await connection`select unit from outings where id=${outingId}`;
  if (!outing || !allows(user,'registrations.add',{unit:outing.unit})) return { error: 'No tenés permiso para gestionar esta salida.', people: [] };
  if (query.trim().length < 2) return { people: [] };
  const result = await searchVolunteers(query,outing.unit === 'Voluntariado General' ? '' : outing.unit,1);
  return { people: result.people.map(person => ({ id: person.id, name: [person.name,person.surname,person.second_surname].filter(Boolean).join(' '), identification: person.identification })), total: result.total };
}

export async function readEditableRegistration(connection:import("postgres").Sql,user:import("./authorization").StaffPrincipal,id:string){
  const [entry] = await connection`select r.starts::text,r.ends::text,r.status,r.details,o.unit,o.flexible,o.starts::text as first_day,o.ends::text as last_day,o.status as outing_status,
    concat_ws(' ',v.name,v.surname,v.second_surname) as name from registrations r join outings o on o.id=r.outing_id
    join volunteers v on v.id=r.volunteer_id where r.id=${id}`;
  if (!entry || !allows(user,'registrations.manage',{unit:entry.unit})) return { error: 'No tenés permiso para editar esta inscripción.' };
  if (!['revisión','espera','confirmada'].includes(entry.status) || !['abierta','confirmada'].includes(entry.outing_status)) return { error: 'Esta inscripción no se puede editar en su estado actual.' };
  return { data: { name: String(entry.name),starts: String(entry.starts),ends: String(entry.ends),
    firstDay:String(entry.first_day),lastDay:String(entry.last_day),flexible: !!entry.flexible,general: entry.unit === 'Voluntariado General',confirmed: entry.status === 'confirmada',
    version: registrationVersion(entry as {starts:string;ends:string;status:string;details:unknown}),...registrationLogistics(entry.details) } };
}

export async function readStaffRegistrationDetail(connection:import("postgres").Sql,user:import("./authorization").StaffPrincipal,id:string){
  const [row] = await connection`select r.id,r.identification,r.status,r.starts::text,r.ends::text,r.received_at,r.details,
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
