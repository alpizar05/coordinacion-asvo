import {allows} from "./auth";
import {field} from "./registration";
import {receiveStaffRegistration} from "./staff-registration";
import {validateStaffParticipation} from "./staff-registration-validation";
import {registrationDetails} from "./registration-validation";
import {editStaffRegistration, registrationVersion} from "./edit-registration";

export async function addRegistrationRecord(tx:import("./registration").Transaction,outingId:string,form:FormData,user:import("./authorization").StaffPrincipal){
 const volunteerId=field(form,"volunteer");
    const [outing] = await tx`select id,unit,status,flexible,starts::text as first_day,ends::text as last_day from outings where id=${outingId} for update`;
    if (!outing || !user || !allows(user,'registrations.add',{unit:outing.unit})) return { error: 'No tenés permiso para gestionar esta salida.' };
    if (field(form,'schedule') !== `${outing.first_day}/${outing.last_day}/${outing.flexible}`) return { error: 'Las fechas de la salida cambiaron. Cerrá el modal y actualizá la página antes de continuar.' };
    const fieldErrors=validateStaffParticipation(form,{flexible:outing.flexible,starts:outing.first_day,ends:outing.last_day},true);
    if(Object.keys(fieldErrors).length)return {fieldErrors};
    return receiveStaffRegistration(tx,outing as {id:string;unit:string;status:string;flexible:boolean;first_day:string;last_day:string},user.subject,volunteerId,field(form,'starts'),field(form,'ends'),registrationDetails(form,outing.unit==='Voluntariado General'));

}

export async function editRegistrationRecord(tx:import("./registration").Transaction,id:string,form:FormData,user:import("./authorization").StaffPrincipal){
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

}
