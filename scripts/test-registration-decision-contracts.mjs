import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const p=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(p)))return next(p.href,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'strip',sourceUrl:url}),shortCircuit:true};return next(url,c);}});
const {sql,demoCoordinator,demoAdmin}=await import('../lib/db.ts');
const {assignRegistration70,changeRegistrationStatus}=await import('../lib/registration-workflow.ts');
const {manageRegistration}=await import('../app/actions/registrations.ts');
const {manageLegacyEntry}=await import('../lib/legacy-entry-management.ts');
const postgres=(await import('postgres')).default;
let calls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('Provider prohibited');};
const form=values=>{const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;};
const snapshot=async(db=sql)=>({entries:await db`select * from registrations order by id`,audit:await db`select * from audit order by id`,mail:await db`select * from registration_mail_outbox order by id`,demo:await db`select * from demo_mail order by id`,briefs:await db`select * from outing_brief_links order by digest`});
const locked=(outing,work)=>sql.begin(async tx=>{await tx`select id from outings where id=${outing} for update`;return work(tx);});
async function outing(capacity=2,unit='Voluntariado General'){
 const id=randomUUID(),request=randomUUID();await sql`insert into requests(id,organization,activity)values(${request},'DEMO decisiones','Ficticia')`;
 await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status)values(${id},${request},'DEMO decisiones','Ficticio',${unit},'2035-01-10','2035-01-12',true,${capacity},'abierta')`;return id;
}
async function entry(outing,status='revisión'){
 const person=randomUUID(),id=randomUUID(),identification=String(880000000+serial++);
 await sql`insert into volunteers(id,identification,name,surname,email)values(${person},${identification},'Persona','Ficticia',${person+'@example.test'})`;
 await sql`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)values(${person},'DEMO','DEMO','2035-01-01','2035-12-31',now())`;
 await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${id},${outing},${person},${identification},'2035-01-10','2035-01-12',${status},'{}'::jsonb)`;return {id,person};
}
let serial=0;
async function requestForm(id,action,extra={}){const [r]=await sql`select md5(to_jsonb(r)::text) as version,o.starts::text,o.ends::text,o.flexible from registrations r join outings o on o.id=r.outing_id where r.id=${id}`;return form({version:r.version,schedule:`${r.starts}/${r.ends}/${r.flexible}`,action,...extra});}
async function invoke(id,data,role='general'){const ctx={cookies:role?{'asvo-demo':role}:{},effects:[]};return requestContext.run(ctx,async()=>({result:await manageRegistration(id,data),effects:ctx.effects}));}
async function failure(id,data,role='general',field,db=sql){const before=await snapshot(db),r=await invoke(id,data,role);assert.notEqual(r.result.saved,true);assert.equal(r.result.destination,undefined);assert.deepEqual(r.effects,[]);if(field)assert.ok(r.result.fieldErrors?.[field]);else{assert.ok(r.result.error);assert.equal(r.result.fieldErrors,undefined);}assert.deepEqual(await snapshot(db),before);return r;}
try{
 await sql`insert into grants(subject,role,unit)values(${demoCoordinator},'general',''),(${demoAdmin},'admin','')`;
 const o=await outing(),a=await entry(o),b=await entry(o,'espera');
 const before=await snapshot();const absent=await locked(o,tx=>assignRegistration70(tx,randomUUID(),'fictitious',true));assert.ok(absent.error);assert.equal(absent.fieldErrors,undefined);assert.deepEqual(await snapshot(),before);
 assert.ok((await locked(o,tx=>assignRegistration70(tx,b.id,'fictitious',true))).error);
 const confirm=await requestForm(a.id,'confirmar');await failure(a.id,confirm,null);await failure(a.id,confirm,'admin');await failure('invalid',confirm);
 const results=await Promise.all([invoke(a.id,confirm),invoke(a.id,confirm)]);assert.equal(results.filter(r=>r.result.saved===true).length,1);assert.equal(results.filter(r=>r.result.error).length,1);
 assert.equal((await sql`select count(*)::int n from audit where target=${a.id} and action='Confirmó cupo'`)[0].n,1);
 assert.equal((await sql`select count(*)::int n from demo_mail where registration_id=${a.id}`)[0].n,1);
 await failure(a.id,confirm); // stale version, no new audit/mail
 await failure(a.id,await requestForm(a.id,'cancelar'),'general','reason');
 await sql`update registrations set starts='2035-01-09' where id=${b.id}`;await failure(b.id,await requestForm(b.id,'confirmar'),'general','approveDates');
 const assigned=await invoke(a.id,await requestForm(a.id,'asignar70'));assert.equal(assigned.result.saved,true);assert.ok(assigned.effects.length);
 const {digest}=await import('../lib/registration.ts');const token='fictitious-brief-token-with-at-least-32-characters';
 await sql`insert into outing_brief_links(digest,outing_id,lead_registration_id,created_by)values(${digest(token)},${o},${a.id},'fictitious')`;
 // Failure during notification must roll back the assignment/revocation/audit too.
 await sql`create function fail_decision_mail()returns trigger language plpgsql as $$begin raise exception 'Synthetic decision mail failure';end$$`;
 await sql`create trigger fail_decision_mail before insert on demo_mail for each row execute function fail_decision_mail()`;
 const failed=await failure(a.id,await requestForm(a.id,'quitar70'));assert.ok(!failed.result.error.includes('Synthetic'));
 await sql`drop trigger fail_decision_mail on demo_mail`;await sql`drop function fail_decision_mail()`;
 const removed=await invoke(a.id,await requestForm(a.id,'quitar70'));assert.equal(removed.result.saved,true);assert.ok((await sql`select revoked_at from outing_brief_links where digest=${digest(token)}`)[0].revoked_at);
 // Compatibility caller consumes the explicit result, preserving its existing redirect payload.
 const duplicateConfirm=await locked(o,tx=>manageLegacyEntry(tx,a.id,false,'',form({action:'confirmar'}),{subject:demoCoordinator,grants:[{role:'general',unit:''}]}));assert.ok(new URL(duplicateConfirm.back,'http://localhost').searchParams.get('error'));
 // Existing rule: FIFO promotion is a real reservation even when the requested reopen cannot fit.
 const reopenOuting=await outing(1),cancelled=await entry(reopenOuting,'cancelada por coordinación'),waiting=await entry(reopenOuting,'espera');
 const fifo=await invoke(cancelled.id,await requestForm(cancelled.id,'confirmar'));assert.ok(fifo.result.error);assert.notEqual(fifo.result.saved,true);assert.deepEqual(fifo.effects,[]);
 assert.equal((await sql`select status from registrations where id=${cancelled.id}`)[0].status,'cancelada por coordinación');
 assert.equal((await sql`select status from registrations where id=${waiting.id}`)[0].status,'revisión');
 assert.equal((await sql`select count(*)::int n from audit where target=${waiting.id} and action='Asignó cupo desde lista de espera'`)[0].n,1);
 assert.equal((await sql`select count(*)::int n from demo_mail where registration_id=${waiting.id}`)[0].n,1);
 // With room for both, policy is still required; the already promoted reservation is preserved.
 await sql`update outings set capacity=2 where id=${reopenOuting}`;
 await sql`update policies set verified_at=null where volunteer_id=${cancelled.person}`;
 await failure(cancelled.id,await requestForm(cancelled.id,'confirmar'));
 assert.equal((await sql`select status from registrations where id=${waiting.id}`)[0].status,'revisión');
 await sql`update policies set verified_at=now() where volunteer_id=${cancelled.person}`;
 const reopened=await invoke(cancelled.id,await requestForm(cancelled.id,'confirmar'));assert.equal(reopened.result.saved,true);
 assert.equal((await sql`select status from registrations where id=${waiting.id}`)[0].status,'revisión');
 // New waitlisted candidate cannot be confirmed with occupied capacity; cancellation promotes FIFO once.
 const last=await entry(reopenOuting,'espera');await failure(last.id,await requestForm(last.id,'confirmar'));
 const cancel=await requestForm(cancelled.id,'cancelar',{reason:'Motivo ficticio'});assert.equal((await invoke(cancelled.id,cancel)).result.saved,true);await failure(cancelled.id,cancel);
 assert.equal((await sql`select status from registrations where id=${last.id}`)[0].status,'revisión');
 assert.equal((await sql`select count(*)::int n from audit where target=${last.id} and action='Asignó cupo desde lista de espera'`)[0].n,1);
 assert.equal((await sql`select count(*)::int n from demo_mail where registration_id=${last.id}`)[0].n,1);
 assert.equal(calls,0);
 const observer=postgres(process.env.DATABASE_URL,{max:1});const validForm=await requestForm(a.id,'quitar70');try{await sql.end();await failure(a.id,validForm,'general',undefined,observer);}finally{await observer.end();}
 console.log('OK: decisiones/70 explícitas, campos y conflictos generales, versión/concurrencia, rollback de cola y promoción FIFO vigente, FIFO, compatibilidad y reintento sin éxitos ni notificaciones falsas.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
