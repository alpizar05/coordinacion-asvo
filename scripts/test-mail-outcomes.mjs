import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';
const target=requireDisposableTestDatabase();
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {flushRegistrationMail} from '../lib/mail-outbox.mjs';
import {graphMail} from '../lib/graph-mail.mjs';
import {recoverMailAttempts,claimMail,beginMailDispatch,resolveUncertainMail,mailReviewInventory} from '../lib/mail-attempts.mjs';
const sql=postgres(target.href,{max:6,onnotice(){}});
// All provider access must use this injected transport; accidental network calls fail closed.
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Red real prohibida');};
let sends=0,tokens=0,mode=202,onSend=null;
const events=[];
const graph=graphMail({env:{GRAPH_TENANT_ID:'11111111-1111-4111-8111-111111111111',GRAPH_CLIENT_ID:'22222222-2222-4222-8222-222222222222',GRAPH_CLIENT_SECRET:'never-log-this',GRAPH_SENDER:'coordination@example.test'},request:async(url,options)=>{
 if(String(url).includes('/token')){tokens++;return Response.json({access_token:'never-store-this'});}
 assert.match(String(url),/\/sendMail$/);sends++;
 const body=JSON.parse(options.body),correlation=options.headers['client-request-id'];
 assert.equal(body.message.internetMessageHeaders[0].value,correlation);assert.equal(options.headers['return-client-request-id'],'true');
 assert.match(body.message.body.content,/Contenido ficticio/);assert.equal(body.message.body.contentType,'HTML');
 events.push({recipient:body.message.toRecipients[0].emailAddress.address,subject:body.message.subject});
 if(onSend){const work=onSend;onSend=null;await work();}
 if(mode==='timeout')throw new DOMException('Synthetic ambiguous timeout','TimeoutError');
 return new Response(null,{status:mode,headers:{'request-id':randomUUID(),'retry-after':'600'}});
}});
async function registration(){
 const request=randomUUID(),outing=randomUUID(),volunteer=randomUUID(),id=randomUUID();
 await sql`insert into requests(id,organization,activity)values(${request},'Ficticia','Demo')`;
 await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status)values(${outing},${request},'Ficticia','Local','Voluntariado General','2035-01-01','2035-01-02',false,3,'abierta')`;
 await sql`insert into volunteers(id,identification,name,surname,email)values(${volunteer},${volunteer},'Ficticia','Local','person@example.test')`;
 await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${id},${outing},${volunteer},${volunteer},'2035-01-01','2035-01-02','revisión','{}'::jsonb)`;
 return id;
}
async function mail(reg,subject='Ficticio',recipient='fake@example.invalid'){
 reg??=await registration();const [row]=await sql`insert into registration_mail_outbox(registration_id,recipient,url,subject,body,html_body)
 values(${reg},${recipient},'/not-a-real-token',${subject},'Contenido ficticio','<p>Contenido ficticio</p>')returning *`;return row;
}
const read=async id=>(await sql`select * from registration_mail_outbox where id=${id}`)[0];
const attempts=async id=>await sql`select * from registration_mail_attempts where mail_id=${id} order by number`;
const flush=(db=sql,options={})=>flushRegistrationMail(db,{graph,...options});
async function expire(row){await sql`update registration_mail_attempts set lease_until=clock_timestamp()-interval '1 second' where id=${row.active_attempt}`;}
try{
 // Actual acceptance evidence survives a separate sent_at failure; recovery never calls Graph again.
 const accepted=await mail();
 await sql.unsafe(`create function fail_mail_projection()returns trigger language plpgsql as $$begin if NEW.sent_at is not null then raise exception 'Synthetic sent_at failure';end if;return NEW;end$$;create trigger fail_mail_projection before update on registration_mail_outbox for each row execute function fail_mail_projection();`);
 assert.deepEqual(await flush(),{sent:0,failed:1});assert.equal(sends,1);let row=await read(accepted.id);assert.equal(row.sent_at,null);
 const [evidence]=await attempts(accepted.id);assert.equal(evidence.state,'accepted');assert.equal(evidence.http_status,202);assert.ok(evidence.graph_request_id);assert.ok(evidence.accepted_at);assert.equal(evidence.acceptance_source,'graph');
 await sql`drop trigger fail_mail_projection on registration_mail_outbox`;
 await flush();await flush();assert.equal(sends,1);assert.ok((await read(accepted.id)).sent_at);assert.equal((await attempts(accepted.id)).length,1);
 // Lost acknowledgement after the acceptance transaction committed must not downgrade its evidence.
 const ack=await mail();let loseAck=true;
 const ackSql=new Proxy(sql,{get(target,key){if(key==='begin')return async callback=>{const result=await target.begin(callback);const found=await attempts(ack.id);if(loseAck&&found.some(a=>a.state==='accepted')){loseAck=false;throw Error('Synthetic lost COMMIT acknowledgement');}return result;};return Reflect.get(target,key);}});
 const ackBefore=sends;await flush(ackSql);assert.equal((await attempts(ack.id))[0].state,'accepted');await flush();await flush();assert.equal(sends,ackBefore+1);assert.ok((await read(ack.id)).sent_at);
 // Even if storing acceptance itself fails, a durable sending marker prevents blind retry.
 const lost=await mail();await sql.unsafe(`create function fail_mail_outcome()returns trigger language plpgsql as $$begin if NEW.state in ('accepted','uncertain') then raise exception 'Synthetic outcome DB failure';end if;return NEW;end$$;create trigger fail_mail_outcome before update on registration_mail_attempts for each row execute function fail_mail_outcome();`);
 const sentBefore=sends;await flush();assert.equal(sends,sentBefore+1);row=await read(lost.id);assert.equal(row.delivery_state,'sending');
 await sql`drop trigger fail_mail_outcome on registration_mail_attempts`;await expire(row);await flush();await flush();assert.equal(sends,sentBefore+1);row=await read(lost.id);assert.equal(row.delivery_state,'uncertain');
 const inventory=await mailReviewInventory(sql);assert.ok(inventory.some(r=>r.mail_id===lost.id));assert.doesNotMatch(JSON.stringify(inventory),/never-store|never-log|fake@|Contenido|not-a-real-token/);
 const beforePlan=await read(lost.id);const plan=spawnSync(process.execPath,['scripts/mail-review.mjs'],{env:process.env,encoding:'utf8'});assert.equal(plan.status,0,plan.stderr);assert.ok(JSON.parse(plan.stdout).some(r=>r.mail_id===lost.id));assert.deepEqual(await read(lost.id),beforePlan);
 const invalidCLI=spawnSync(process.execPath,['scripts/mail-review.mjs','--decision=retry'],{env:process.env,encoding:'utf8'});assert.notEqual(invalidCLI.status,0);assert.doesNotMatch(plan.stdout,/Contenido|fake@|not-a-real-token/);

 const resolution={mailId:lost.id,attemptId:row.active_attempt,actor:'test-operator',decision:'accepted',reason:'acceptance_evidence',evidence:randomUUID()};
 assert.deepEqual(await resolveUncertainMail(sql,resolution),{resolved:true});assert.deepEqual(await resolveUncertainMail(sql,resolution),{resolved:false});await flush();assert.equal(sends,sentBefore+1);
 // Ambiguous timeout blocks later notifications for that registration, not unrelated registrations.
 mode='timeout';const ambiguous=await mail();const later=await mail(ambiguous.registration_id,'Segundo');
 await flush();const afterTimeout=sends;row=await read(ambiguous.id);assert.equal(row.delivery_state,'uncertain');assert.equal((await attempts(ambiguous.id))[0].outcome_code,'transport_ambiguous');
 mode=202;await flush();await flush();assert.equal(sends,afterTimeout);assert.equal((await read(later.id)).attempts,0);
 await assert.rejects(()=>resolveUncertainMail(sql,{mailId:ambiguous.id,attemptId:row.active_attempt,actor:'test',decision:'retry',reason:'duplicate_risk_acknowledged'}),/venza/);
 await expire(row);const retry={mailId:ambiguous.id,attemptId:row.active_attempt,actor:'test',decision:'retry',reason:'duplicate_risk_acknowledged'};
 const decisions=await Promise.allSettled([resolveUncertainMail(sql,retry),resolveUncertainMail(sql,{...retry,decision:'cancel',reason:'cancel_after_review'})]);assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1);
 // Whether retry or cancel won, idempotent repeated review cannot affect a newer attempt.
 const [decision]=await sql`select * from registration_mail_reviews where attempt_id=${row.active_attempt}`;
 if(decision.decision==='retry'){
  await resolveUncertainMail(sql,retry);await flush();await flush();assert.equal((await attempts(ambiguous.id)).length,2);
  await resolveUncertainMail(sql,retry);assert.equal((await read(ambiguous.id)).delivery_state,'accepted');
 }else{await flush();assert.equal((await read(ambiguous.id)).delivery_state,'cancelled');}
 assert.ok((await read(later.id)).sent_at);
 // Confirmed 429 is safe to retry; delay/order and repeated retries are preserved.
 const rejected=await mail();mode=429;await flush();row=await read(rejected.id);const [rejection]=await attempts(rejected.id);assert.equal(rejection.state,'rejected');assert.equal(row.delivery_state,'pending');assert.equal(rejection.http_status,429);assert.ok(row.retry_at.getTime()-Date.now()>590000);
 const rejectedSends=sends;await flush();assert.equal(sends,rejectedSends);
 await sql`update registration_mail_outbox set retry_at=clock_timestamp()-interval '1 second' where id=${rejected.id}`;mode=202;await flush();await flush();assert.equal(sends,rejectedSends+1);assert.equal((await attempts(rejected.id)).length,2);
 // A 503 from sendMail is not confused with a known pre-send authentication failure.
 const serverFailure=await mail();mode=503;await flush();row=await read(serverFailure.id);assert.equal(row.delivery_state,'uncertain');await expire(row);await resolveUncertainMail(sql,{mailId:row.id,attemptId:row.active_attempt,actor:'test',decision:'cancel',reason:'cancel_after_review'});mode=202;
 const auth=await mail();const beforeAuth=sends;await flush(sql,{graph:{authenticate:async()=>{throw Error('Synthetic auth failure');},send:async()=>{throw Error('Must not send');}}});assert.equal(sends,beforeAuth);assert.equal((await attempts(auth.id))[0].state,'rejected');
 await sql`update registration_mail_outbox set retry_at=clock_timestamp()-interval '1 second' where id=${auth.id}`;await flush();
 // Two workers, no locks during Graph: same registration ordered; other registration can proceed.
 const first=await mail(null,'Orden 1','ordered@example.invalid');const second=await mail(first.registration_id,'Orden 2','ordered@example.invalid');const independent=await mail(null,'Otro','other@example.invalid');
 let release,entered;const started=new Promise(r=>entered=r),wait=new Promise(r=>release=r);
 onSend=async()=>{await sql.begin(async tx=>{await tx`select id from registration_mail_outbox where id=${first.id} for update nowait`;});entered();await wait;};
 const workerA=flush();await started;await flush();assert.equal((await read(second.id)).attempts,0);assert.ok((await read(independent.id)).sent_at);release();await workerA;
 assert.ok((await read(second.id)).sent_at);assert.equal((await attempts(first.id)).length,1);assert.equal((await attempts(second.id)).length,1);assert.deepEqual(events.filter(e=>e.recipient==='ordered@example.invalid').map(e=>e.subject),['Orden 1','Orden 2']);
 // A lease lost before dispatch is retryable; after dispatch, it is quarantined.
 const reserved=await mail();const claim=await claimMail(sql);assert.equal(claim.mail.id,reserved.id);await expire(await read(reserved.id));await recoverMailAttempts(sql);assert.equal((await read(reserved.id)).delivery_state,'pending');assert.equal(await beginMailDispatch(sql,claim.mail,claim.attempt),false);
 await sql`update registration_mail_outbox set retry_at=clock_timestamp()-interval '1 second' where id=${reserved.id}`;await flush();
 const abandoned=await mail();const dispatch=await claimMail(sql);await beginMailDispatch(sql,dispatch.mail,dispatch.attempt);await expire(await read(abandoned.id));await flush();row=await read(abandoned.id);assert.equal(row.delivery_state,'uncertain');await resolveUncertainMail(sql,{mailId:row.id,attemptId:row.active_attempt,actor:'test',decision:'cancel',reason:'cancel_after_review'});
 // .test never authenticates, sends, or leaks data; budget and thirty-send cap are unchanged.
 const test=await mail(null,'Prueba','person@example.invalid.TEST');const priorTokens=tokens,priorSends=sends;await flush();assert.equal(tokens,priorTokens);assert.equal(sends,priorSends);assert.ok((await read(test.id)).cancelled_at);
 const capped=await registration();for(let i=0;i<35;i++)await mail(capped,'Límite '+i);const capSends=sends;await flush(sql,{now:()=>1000});assert.equal(sends-capSends,30);await flush(sql,{budgetMs:21999});assert.equal(sends-capSends,30);await flush();assert.equal(sends-capSends,35);
 console.log('OK: aceptación durable/proyección fallida, DB indisponible tras 202, timeout/503 inciertos sin reenvío, 429/auth retry, orden, dos workers sin bloqueos, revisión versionada e idempotente, .test y límites. Graph simulado; sin proveedores reales.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
