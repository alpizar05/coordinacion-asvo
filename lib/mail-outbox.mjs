import {graphMail} from './graph-mail.mjs';
import {claimMail,recoverMailAttempts,cancelClaim,beginMailDispatch,recordMailOutcome,projectMailAcceptance} from './mail-attempts.mjs';
/** Test recipients must never reach Microsoft Graph, including queued retries. */
export const isTestRecipient = recipient => String(recipient ?? '').trim().toLowerCase().endsWith('.test');

/** Revalidate reminders at dispatch time; ordinary registration mail is unaffected. */
export async function reportReminderIsCurrent(sql, mailId) {
  const [reminder] = await sql`select q.id from report_reminders q where q.mail_id=${mailId}`;
  if (!reminder) return true;
  const [valid] = await sql`select 1 from report_reminders q
    join registrations r on r.id=q.registration_id join volunteers v on v.id=r.volunteer_id
    join outings o on o.id=r.outing_id join outing_brief_links l on l.digest=q.link_digest
    where q.mail_id=${mailId} and r.status='confirmada' and r.details->'assigned70'='true'::jsonb
      and o.status in ('abierta','confirmada','completada') and o.ends<(clock_timestamp() at time zone 'America/Costa_Rica')::date
      and l.outing_id=o.id and l.lead_registration_id=r.id and l.revoked_at is null and l.expires_at>clock_timestamp()
      and v.email=q.recipient and not exists(select 1 from outing_reports p where p.status='finalizado' and p.outing_id=o.id and p.lead_registration_id=r.id)`;
  return !!valid;
}

/** sent means durable acceptance by Graph, not delivery to the recipient. */
export async function flushRegistrationMail(sql, { budgetMs = 35000, graph=graphMail(), now=Date.now } = {}) {
  if(typeof sql.begin!=='function')throw Error('El worker requiere una conexión raíz: no despachar dentro de una transacción.');
  const deadline = now() + budgetMs;
  const result = { sent: 0, failed: 0 };
  const recovered=await recoverMailAttempts(sql);
  if(recovered.uncertain)console.warn('[mail-review] Intentos vencidos requieren revisión:',recovered.uncertain);
  for(let index=0;index<30;index++){
    if(now()+22000>deadline)break;
    const claimed=await claimMail(sql);if(!claimed)break;
    const {mail,attempt}=claimed;
    let dispatchStarted=false,acceptanceRecorded=false;
    try{
      if(isTestRecipient(mail.recipient)){await cancelClaim(sql,mail,attempt,'test_recipient');continue;}
      if(!await reportReminderIsCurrent(sql,mail.id)){await cancelClaim(sql,mail,attempt,'reminder_obsolete');continue;}
      const token=await graph.authenticate();
      if(!await beginMailDispatch(sql,mail,attempt))continue;
      dispatchStarted=true;
      let outcome;
      try{outcome=await graph.send(mail,token,attempt);}
      catch{outcome={state:'uncertain',code:'transport_ambiguous'};}
      await recordMailOutcome(sql,mail,attempt,{...outcome,code:outcome.code??(outcome.state==='accepted'?'graph_accepted':outcome.state==='rejected'?'graph_rejected':'response_ambiguous')});
      if(outcome.state==='accepted'){
        acceptanceRecorded=true;
        await projectMailAcceptance(sql,mail,attempt);result.sent++;
      }else{
        result.failed++;console.error('[mail-outcome]',JSON.stringify({mail:mail.id,attempt:attempt.id,state:outcome.state}));break;
      }
    }catch{
      result.failed++;
      // Never downgrade durable acceptance. If DB is unavailable, the expired lease is quarantined.
      if(!acceptanceRecorded)try{await recordMailOutcome(sql,mail,attempt,{state:dispatchStarted?'uncertain':'rejected',code:dispatchStarted?'persistence_ambiguous':'before_dispatch_failed'});}catch{}
      console.error('[mail-outcome]',JSON.stringify({mail:mail.id,attempt:attempt.id,state:acceptanceRecorded?'accepted_pending_projection':dispatchStarted?'uncertain':'rejected'}));break;
    }
  }
  return result;
}
