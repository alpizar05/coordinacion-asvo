import 'server-only';
import {allows,type StaffPrincipal} from './authorization';
import {audit,type Transaction} from './registration';
/** Internal use cases only; a future UI/CLI must authenticate before calling. */
export async function revokeRegistrationLinks(tx:Transaction,id:string,user:StaffPrincipal){
 const [ref]=await tx`select outing_id from registrations where id=${id}`;
 const [outing]=ref?await tx`select unit from outings where id=${ref.outing_id} for update`:[];
 if(!outing||!allows(user,'registrations.manage',{unit:outing.unit}))throw Error('Acceso denegado.');
 const [entry]=await tx`select outing_id from registrations where id=${id} for update`;
 if(!entry||entry.outing_id!==ref.outing_id)throw Error('La inscripción cambió; volvé a consultar.');
 await tx`update links set revoked_at=clock_timestamp() where registration_id=${id} and revoked_at is null`;
 await tx`update registration_receipts set revoked_at=clock_timestamp() where registration_id=${id} and revoked_at is null`;
 await audit(tx,user!.subject,'Revocó enlaces privados de inscripción',id);
}
export async function revokeOutingInvitations(tx:Transaction,id:string,user:StaffPrincipal){
 const [outing]=await tx`select unit from outings where id=${id} for update`;
 if(!outing||!allows(user,'invitations.generate',{unit:outing.unit}))throw Error('Acceso denegado.');
 await tx`update outing_invitations set revoked_at=clock_timestamp() where outing_id=${id} and revoked_at is null`;
 await audit(tx,user!.subject,'Revocó invitaciones de salida',id);
}
