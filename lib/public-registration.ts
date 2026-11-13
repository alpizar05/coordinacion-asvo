import {consumeAbuseLimit,rateLimitMessage} from './abuse-limits';
import {abuseLimits} from './security-rules.mjs';
import {outingIsOpen,privateRegistrationTransition,editRegistrationTransition} from './workflow-transitions';
import {validPrivateToken} from './authorization';
import {registrationLinkCondition} from './authorization-sql';
import {registrationCoverage} from './registration-coverage';
import {formText} from './form-input';
import { registrationLogistics } from './registration-logistics';
import { registrationChanges } from './registration-changes';
import { notifyRegistration, promoteWaitlist, receiveRegistration } from './registration-workflow';
import { activeOutingInvitation, registrationToday } from './outing-invitations';
import { appUrl,demo } from './db';
import { queueCoordinationCancellationMail } from './registration-mail.mjs';
import { audit,cancellationWarning,digest,eligible,field,type Transaction } from './registration';
import { validateParticipation,validateCancellation,registrationDetails,type RegistrationActionResult } from './registration-validation';

const policyMessage='No encontramos una póliza vigente que cubra todas las fechas de participación. Contactá a Coordinación para actualizar tu póliza y volver a inscribirte.';
const policyError=():Extract<RegistrationActionResult,{saved?:false}>=>({error:policyMessage,issue:{title:'No encontramos una póliza vigente',message:policyMessage}});

/** Caller provides one transaction. The outing lock serializes capacity, invitation use and duplicate checks. */
export async function receivePublicRegistration(tx:Transaction,outingId:string,schedule:string,token:string,form:FormData,ip:string|null):Promise<RegistrationActionResult<{id:string;status:string}>>{
  const idNumber=formText(form,'identification');
  if(ip&&!await consumeAbuseLimit(tx,'register:network',ip,abuseLimits.network))return {error:rateLimitMessage};
  if(/^\d{9}$/.test(idNumber)&&!await consumeAbuseLimit(tx,'register:id',idNumber,abuseLimits.registration))return {error:rateLimitMessage};
  const [outing]=await tx`select *,starts::text as first_day,ends::text as last_day,coalesce(registration_deadline,starts)>=${registrationToday} as accepting from outings where id=${outingId} and status in ('abierta','confirmada') for update`;
  const invitation=await activeOutingInvitation(outingId,token,tx);
  if(!outing||(token&&!invitation)||(!invitation&&(outing.status!=='abierta'||!outing.accepting)))return {error:'La convocatoria está cerrada o la invitación ya no está disponible. Contactá a Coordinación.'};
  if(schedule!==`${outing.first_day}/${outing.last_day}/${outing.flexible}`)return {error:'Las fechas de la salida cambiaron. Tus datos se conservan; recargá la convocatoria y revisá las fechas antes de volver a enviar.'};
  const fieldErrors=validateParticipation(form,{flexible:outing.flexible,starts:outing.first_day,ends:outing.last_day},true);
  if(Object.keys(fieldErrors).length)return {fieldErrors};
  const starts=outing.flexible?field(form,'starts'):outing.first_day,ends=outing.flexible?field(form,'ends'):outing.last_day;
  const [person]=await tx`select id,email from volunteers where identification=${idNumber}`;
  if(!person){
    const message='No encontramos esa identificación en nuestra base de personas voluntarias. Revisá el número ingresado. Si es correcto, contactá a Coordinación para registrar o actualizar tus datos.';
    return {fieldErrors:{identification:message},issue:{title:'Identificación no encontrada',message}};
  }
  if(invitation&&(!person.email||person.id!==invitation.volunteer_id||!await eligible(tx,person.id,outing.unit)))return {error:'Usá la identificación de la persona invitada o contactá a Coordinación.'};
  const coverage=await registrationCoverage(tx,person.id,starts,ends);
  if(!coverage)return policyError();
  if(!person.email||!await eligible(tx,person.id,outing.unit))return {error:'Revisá con Coordinación el correo registrado y la unidad a la que pertenecés.'};
  const registration=await receiveRegistration(tx,{outingId,volunteerId:person.id,identification:idNumber,starts,ends,details:registrationDetails(form,outing.unit==='Voluntariado General')});
  if(registration.duplicate)return {error:'Ya tenés una inscripción activa para esta salida. Usá el enlace privado de tu correo para consultarla o editarla.'};
  if(invitation){
    await tx`update outing_invitations set used_at=clock_timestamp() where digest=${invitation.digest}`;
    await audit(tx,'voluntariado','Usó invitación a salida',registration.id);
  }
  return {saved:true,id:registration.id,status:registration.status};
}

/** A no-op edit is acknowledged without creating another audit entry or email. */
export async function changePrivateRegistration(tx:Transaction,token:string,form:FormData):Promise<RegistrationActionResult>{
  if(!validPrivateToken(token))return {error:'El enlace venció o no permite gestionar esta inscripción. Contactá a Coordinación.'};
  const action=field(form,'action');
  const [link]=await tx`select * from links where ${registrationLinkCondition(tx,token,true)}`;
  if(!link||!['gestionar','validar'].includes(link.purpose))return {error:'El enlace venció o no permite gestionar esta inscripción. Contactá a Coordinación.'};
  const [entry]=await tx`select outing_id from registrations where id=${link.registration_id}`;
  if(!entry)return {error:'La inscripción ya no está disponible.'};
  const [outing]=await tx`select unit,status,flexible,starts::text as first_day,ends::text as last_day from outings where id=${entry.outing_id} for update`;
  const [current]=await tx`select id,status,outing_id,starts::text as first_day,ends::text as last_day,volunteer_id,details from registrations where id=${link.registration_id} for update`;
  if(!outing||!current||current.outing_id!==entry.outing_id||!outingIsOpen(outing.status))return {error:'La salida cambió o ya no permite modificaciones. Actualizá la página o contactá a Coordinación.'};
  const decision=privateRegistrationTransition(current.status,action);
  if(decision.kind==='noop')return {saved:true};
  if(decision.kind==='error')return {error:decision.error};
  if(decision.kind==='cancel'){
    const fieldErrors=validateCancellation(form,cancellationWarning(current.first_day));
    if(Object.keys(fieldErrors).length)return {fieldErrors};
    await tx`update registrations set status=${decision.status} where id=${current.id}`;
    await audit(tx,'voluntariado',decision.audit,current.id,field(form,'reason'));
    await notifyRegistration(tx,current.id,`Cancelaste tu inscripción. Motivo: ${field(form,'reason')}`);
    await queueCoordinationCancellationMail(tx,current.id,field(form,'reason'),{origin:appUrl(),demo});
    await promoteWaitlist(tx,current.outing_id,'sistema');
    return {saved:true};
  }
  if(action!=='editar')return {error:'Elegí una acción válida.'};
  const fieldErrors=validateParticipation(form,{flexible:outing.flexible,starts:outing.first_day,ends:outing.last_day});
  if(Object.keys(fieldErrors).length)return {fieldErrors};
  const starts=outing.flexible?field(form,'starts'):outing.first_day,ends=outing.flexible?field(form,'ends'):outing.last_day;
  const coverage=await registrationCoverage(tx,current.volunteer_id,starts,ends);
  if(!coverage)return policyError();
  if(!await eligible(tx,current.volunteer_id,outing.unit))return {error:'Tu ficha no pertenece a la unidad requerida. Contactá a Coordinación.'};
  const datesChanged=current.first_day!==starts||current.last_day!==ends;
  const edit=editRegistrationTransition(current.status,datesChanged,'private');
  const status=edit.status;
  const details={...registrationDetails(form,outing.unit==='Voluntariado General'),...(status==='confirmada'&&current.details?.assigned70===true?{assigned70:true}:{})};
  const changes=registrationChanges({starts:current.first_day,ends:current.last_day,status:current.status,details:current.details},{starts,ends,status,details});
  if(!datesChanged&&status===current.status&&JSON.stringify(registrationLogistics(current.details))===JSON.stringify(registrationLogistics(details))&&(current.details?.assigned70===true)===(details.assigned70===true))return {saved:true};
  await tx`update registrations set details=${tx.json(details)},starts=${starts},ends=${ends},status=${status} where id=${current.id}`;
  if(status!=='confirmada')await tx`update outing_brief_links set revoked_at=now() where lead_registration_id=${current.id} and revoked_at is null`;
  await audit(tx,'voluntariado',edit.audit,current.id,changes);
  await notifyRegistration(tx,current.id,edit.message);
  return {saved:true};
}
