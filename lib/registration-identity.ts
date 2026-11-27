import 'server-only';
import {consumeAbuseLimit,rateLimitMessage} from './abuse-limits';
import {activeOutingInvitation,registrationToday} from './outing-invitations';
import {uuid,type Transaction} from './registration';

export type RegistrationIdentityResult = {kind:'found';name:string}|{kind:'not-found'}|{kind:'error';message:string};
/** Only the name is disclosed. Lookup does not check coverage, reserve seats or notify. */
export async function readRegistrationIdentity(tx:Transaction,outingId:unknown,identification:unknown,token:unknown,network:string|null):Promise<RegistrationIdentityResult>{
 if(typeof outingId!=='string'||!uuid(outingId)||typeof identification!=='string'||!/^\d{9}$/.test(identification)||typeof token!=='string'||token.length>256)return {kind:'error',message:'Revisá los 9 dígitos de la identificación.'};
 // Separate committed lookup counters; never consume the submission budget.
 if(!await consumeAbuseLimit(tx,'identity:network',network??'local:'+outingId,300)||!await consumeAbuseLimit(tx,'identity:id',identification,30))return {kind:'error',message:rateLimitMessage};
 const [outing]=await tx`select status,coalesce(registration_deadline,starts)>=${registrationToday} as accepting from outings where id=${outingId} and status in ('abierta','confirmada')`;
 if(!outing)return {kind:'error',message:'La convocatoria ya no está disponible.'};
 const invitation=token?await activeOutingInvitation(outingId,token,tx):undefined;
 if((token&&!invitation)||(!invitation&&(outing.status!=='abierta'||!outing.accepting)))return {kind:'error',message:'La convocatoria o la invitación ya no permite consultar el registro.'};
 const [person]=await tx`select id,concat_ws(' ',name,surname,second_surname) as name from volunteers where identification=${identification}`;
 if(invitation&&person?.id!==invitation.volunteer_id)return {kind:'not-found'};
 return person?{kind:'found',name:person.name}:{kind:'not-found'};
}
