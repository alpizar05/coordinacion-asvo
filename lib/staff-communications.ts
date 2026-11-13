import {type FormResult} from "./form-result";
import {canOperate, requireStaff, allows} from "./auth";
import {audit, digest, eligible, identification, field} from "./registration";
import {queueReportReminder} from "./report-reminders";

export async function createStaffInvitation(tx:import("./registration").Transaction,id:string,number:string,token:string,link:string,user:import("./authorization").StaffPrincipal):Promise<FormResult & {link?:string}>{
    const [outing] = await tx`select unit,status from outings where id=${id} for update`;
    requireStaff(user, !!outing && canOperate(user, outing.unit));
    if (!['abierta','confirmada'].includes(outing.status)) return { error: 'La salida debe estar abierta o confirmada.' };
    const [person] = await tx`select id,email from volunteers where identification=${number}`;
    if(!person)return {fieldErrors:{identification:'No encontramos esa identificación en el registro de voluntariado.'}};
    if (!person.email || !await eligible(tx, person.id, outing.unit)) {
      return { error: 'Revisá la identificación, el correo y la unidad de la persona voluntaria.' };
    }
    await tx`insert into outing_invitations(digest,outing_id,volunteer_id,expires_at)
      values (${digest(token)},${id},${person.id},now() + interval '7 days')`;
    await audit(tx, user.subject, 'Generó invitación a salida', id, person.id);
    return { saved:true,link };

}

export async function generateStaffBrief(tx:import("./registration").Transaction,id:string,lead:string,token:string,user:import("./authorization").StaffPrincipal){
    const [outing] = await tx`select unit,status from outings where id=${id} for update`;
    requireStaff(user,!!outing && allows(user,'briefs.generate',{unit:outing.unit}));
    if (!['abierta','confirmada','completada'].includes(outing.status)) return 'No se puede compartir una salida cancelada o en borrador.';
    const [person] = await tx`select id from registrations where id=${lead} and outing_id=${id}
      and status='confirmada' and details->'assigned70'='true'::jsonb`;
    if (!person) return 'La persona debe tener inscripción confirmada y estar asignada como 70.';
    await tx`update outing_brief_links set revoked_at=now() where outing_id=${id} and lead_registration_id=${lead} and revoked_at is null`;
    await tx`insert into outing_brief_links(digest,outing_id,lead_registration_id,created_by) values (${digest(token)},${id},${lead},${user.subject})`;
    await audit(tx,user.subject,'Generó resumen para 70',id,`Inscripción: ${lead}`);

}

export async function revokeStaffBrief(tx:import("./registration").Transaction,id:string,user:import("./authorization").StaffPrincipal){
    const [outing] = await tx`select unit from outings where id=${id} for update`;
    requireStaff(user,!!outing && allows(user,'briefs.revoke',{unit:outing.unit}));
    await tx`update outing_brief_links set revoked_at=now() where outing_id=${id} and revoked_at is null`;
    await audit(tx,user.subject,'Revocó enlaces de resumen para 70',id);

}

export async function queueStaffReportReminder(tx:import("./registration").Transaction,outingId:string,registrationId:string,form:FormData,user:import("./authorization").StaffPrincipal){
    const [outing] = await tx`select unit from outings where id=${outingId} for update`;
    if (!outing || !user || !allows(user,'reports.remind',{unit:outing.unit})) return { error: 'No tenés permiso para gestionar esta salida.' };
    return queueReportReminder(tx,outingId,registrationId,user.subject,field(form,'email'));

}
