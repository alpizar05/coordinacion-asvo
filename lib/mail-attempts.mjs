import {randomUUID} from 'node:crypto';
import {validateMailReview} from './mail-attempt-rules.mjs';

/** All transactions are short. Never pass a TransactionSql to the worker. */
export async function recoverMailAttempts(sql) {
 return sql.begin(async tx=>{
  const rows=await tx`select m.id,m.active_attempt,a.state,a.lease_until,a.accepted_at
   from registration_mail_outbox m join registration_mail_attempts a on a.id=m.active_attempt
   where m.sent_at is null and m.cancelled_at is null
    and (a.state='accepted' or (m.delivery_state in ('reserved','sending') and a.lease_until<clock_timestamp()))
   order by m.id for update of m skip locked limit 30`;
  let uncertain=0;
  for(const row of rows){
   if(row.state==='accepted'){
    await tx`update registration_mail_outbox set delivery_state='accepted',sent_at=${row.accepted_at} where id=${row.id}`;
   }else if(row.state==='reserved'){
    await tx`update registration_mail_attempts set state='rejected',finished_at=clock_timestamp(),outcome_code='lease_before_dispatch' where id=${row.active_attempt} and state='reserved'`;
    await tx`update registration_mail_outbox set delivery_state='pending',retry_at=clock_timestamp()+interval '5 minutes' where id=${row.id}`;
   }else{
    await tx`update registration_mail_attempts set state='uncertain',finished_at=clock_timestamp(),outcome_code='lease_after_dispatch' where id=${row.active_attempt} and state='sending'`;
    await tx`update registration_mail_outbox set delivery_state='uncertain' where id=${row.id}`;uncertain++;
   }
  }
  return {uncertain};
 });
}
export async function claimMail(sql) {
 return sql.begin(async tx=>{
  const [mail]=await tx`select pending.id,pending.recipient,pending.subject,pending.body,pending.html_body,pending.attempts
   from registration_mail_outbox pending where pending.sent_at is null and pending.cancelled_at is null
    and pending.delivery_state='pending' and pending.retry_at<=clock_timestamp()
    and not exists(select 1 from registration_mail_outbox earlier where earlier.registration_id=pending.registration_id
     and earlier.id<pending.id and earlier.sent_at is null and earlier.cancelled_at is null)
   order by pending.id for update of pending skip locked limit 1`;
  if(!mail)return;
  const id=randomUUID(),client=id;
  const [attempt]=await tx`insert into registration_mail_attempts(id,mail_id,number,state,lease_until,client_request_id)
   values(${id},${mail.id},${mail.attempts+1},'reserved',clock_timestamp()+interval '5 minutes',${client}) returning *`;
  await tx`update registration_mail_outbox set active_attempt=${id},delivery_state='reserved',attempts=attempts+1,retry_at=clock_timestamp()+interval '5 minutes' where id=${mail.id}`;
  return {mail,attempt};
 });
}
export async function cancelClaim(sql,mail,attempt,code) {
 return sql.begin(async tx=>{
  const [current]=await tx`select id from registration_mail_outbox where id=${mail.id} and active_attempt=${attempt.id} and delivery_state='reserved' for update`;
  if(!current)return;
  await tx`update registration_mail_attempts set state='cancelled',finished_at=clock_timestamp(),outcome_code=${code} where id=${attempt.id}`;
  await tx`update registration_mail_outbox set delivery_state='cancelled',cancelled_at=clock_timestamp() where id=${mail.id}`;
 });
}
export async function beginMailDispatch(sql,mail,attempt) {
 return sql.begin(async tx=>{
  const [current]=await tx`select id from registration_mail_outbox where id=${mail.id} and active_attempt=${attempt.id}
   and delivery_state='reserved' and sent_at is null and cancelled_at is null for update`;
  if(!current)return false;
  const [live]=await tx`update registration_mail_attempts set state='sending',dispatched_at=clock_timestamp()
   where id=${attempt.id} and state='reserved' and lease_until>clock_timestamp() returning id`;
  if(!live)return false;
  await tx`update registration_mail_outbox set delivery_state='sending' where id=${mail.id}`;
  return true;
 });
}
/** Persist outcome evidence FIRST. sent_at is projected independently after acceptance. */
export async function recordMailOutcome(sql,mail,attempt,outcome) {
 return sql.begin(async tx=>{
  const [current]=await tx`select active_attempt,delivery_state from registration_mail_outbox where id=${mail.id} for update`;
  if(!current||current.active_attempt!==attempt.id)throw Error('El intento de correo cambió.');
  const [updated]=await tx`update registration_mail_attempts set state=${outcome.state},finished_at=clock_timestamp(),
   accepted_at=case when ${outcome.state}='accepted' then clock_timestamp() else null end,
   acceptance_source=case when ${outcome.state}='accepted' then 'graph' else null end,
   http_status=${outcome.status??null},graph_request_id=${outcome.requestId??null},outcome_code=${outcome.code}
   where id=${attempt.id} and state in ('reserved','sending','uncertain')
    and not exists(select 1 from registration_mail_reviews where attempt_id=${attempt.id}) returning id`;
  if(!updated)throw Error('El resultado del intento ya fue resuelto.');
  // Acceptance remains fenced in 'sending' until its durable evidence can be projected.
  if(outcome.state!=='accepted')await tx`update registration_mail_outbox set delivery_state=${outcome.state==='rejected'?'pending':'uncertain'},
   retry_at=clock_timestamp()+${outcome.retryMs??300000}*interval '1 millisecond' where id=${mail.id}`;
 });
}
export async function projectMailAcceptance(sql,mail,attempt) {
 await sql`update registration_mail_outbox m set sent_at=a.accepted_at,delivery_state='accepted'
  from registration_mail_attempts a where m.id=${mail.id} and m.active_attempt=${attempt.id}
   and a.id=m.active_attempt and a.state='accepted' and m.sent_at is null and m.cancelled_at is null`;
}
/** Metadata only: no recipient, subject, content, management URL or secrets. */
export async function mailReviewInventory(sql) {
 return sql`select m.id as mail_id,m.delivery_state,a.id as attempt_id,a.number,a.state,a.outcome_code,
   a.client_request_id,a.graph_request_id,a.http_status,a.started_at,a.dispatched_at,a.finished_at,a.lease_until
  from registration_mail_outbox m left join registration_mail_attempts a on a.id=m.active_attempt
  where m.sent_at is null and m.cancelled_at is null and (m.delivery_state='uncertain' or a.state='accepted'
   or (m.delivery_state in ('reserved','sending') and a.lease_until<clock_timestamp())) order by m.id limit 100`;
}
/** Explicit operator resolution, bound to the observed attempt. Never sends mail. */
export async function resolveUncertainMail(sql,input) {
 validateMailReview(input);
 return sql.begin(async tx=>{
  const [mail]=await tx`select * from registration_mail_outbox where id=${input.mailId} for update`;
  if(!mail)throw Error('El correo no existe.');
  const [review]=await tx`select * from registration_mail_reviews where attempt_id=${input.attemptId}`;
  if(review){
   if(review.decision===input.decision&&review.actor===input.actor&&review.reason===input.reason&&(review.evidence??null)===(input.evidence??null))return {resolved:false};
   throw Error('Este intento ya tiene otra revisión.');
  }
  if(mail.active_attempt!==input.attemptId||mail.sent_at||mail.cancelled_at||mail.delivery_state!=='uncertain')throw Error('El estado o intento cambió; consultá nuevamente.');
  const [attempt]=await tx`select *,lease_until<=clock_timestamp() as expired from registration_mail_attempts where id=${input.attemptId} for update`;
  if(!attempt||!attempt.expired||attempt.state!=='uncertain')throw Error('Esperá a que venza la reserva antes de revisar el resultado incierto.');
  await tx`insert into registration_mail_reviews(attempt_id,decision,actor,reason,evidence) values(${input.attemptId},${input.decision},${input.actor},${input.reason},${input.evidence??null})`;
  if(input.decision==='accepted'){
   await tx`update registration_mail_attempts set state='accepted',acceptance_source='review',accepted_at=clock_timestamp() where id=${input.attemptId}`;
   await tx`update registration_mail_outbox set delivery_state='accepted',sent_at=clock_timestamp() where id=${mail.id}`;
  }else if(input.decision==='cancel')await tx`update registration_mail_outbox set delivery_state='cancelled',cancelled_at=clock_timestamp() where id=${mail.id}`;
  else await tx`update registration_mail_outbox set delivery_state='pending',retry_at=clock_timestamp() where id=${mail.id}`;
  return {resolved:true};
 });
}
