import {allows,staffScope,type StaffPrincipal} from './authorization';
import {sql} from './db';
import {digest,type Transaction} from './registration';
type Db=typeof sql|Transaction;
/** SQL remains authoritative for expiry, revocation, assignment and resource binding. */
export function invitationAccessCondition(db:Db,outingId:string,token:string){
 return db`digest=${digest(token)} and outing_id=${outingId} and used_at is null and revoked_at is null and expires_at>clock_timestamp()`;
}
/** Requires the existing l/r/o joins, including r.outing_id=l.outing_id. */
export function briefAccessCondition(db:Db,token:string){
 return db`l.digest=${digest(token)} and l.revoked_at is null and l.expires_at>clock_timestamp()
   and r.status='confirmada' and r.details->'assigned70'='true'::jsonb
   and o.status in ('abierta','confirmada','completada')`;
}
/** The read page accepts historical purposes; mutation checks its stricter purpose separately. */
export function registrationLinkCondition(db:Db,token:string,live=false,alias=false){
 return alias?db`l.digest=${digest(token)} and l.revoked_at is null and l.purpose in ('gestionar','validar','gestion') and l.expires>clock_timestamp()`:
   db`digest=${digest(token)} and revoked_at is null and purpose in ('gestionar','validar','gestion') and expires>clock_timestamp()`;
}

/** Manual series: general coordinator or owning unit coordinator; membership is scoped separately. */
export function collectionAccessCondition(db:Db,user:StaffPrincipal,aliased=false){
 const allowed=allows(user,'operations.read'),general=staffScope(user).general,subject=user?.subject??'';
 return aliased?db`${allowed} and (${general} or c.created_by=${subject})`:db`${allowed} and (${general} or created_by=${subject})`;
}
