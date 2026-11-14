import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const p=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(p)))return next(p.href,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'strip',sourceUrl:url}),shortCircuit:true};return next(url,c);}});
const {sql,demoCoordinator,demoAdmin}=await import('../lib/db.ts');
const {digest}=await import('../lib/registration.ts');
const {briefAccess}=await import('../lib/outing-brief.ts');
const {generateBrief,revokeBrief}=await import('../app/actions/communications.ts');
const compatible=await import('../app/coordinacion/salidas/[id]/resumen/actions.ts');
const {randomBytes}=await import('node:crypto');
const postgres=(await import('postgres')).default;
const outing=randomUUID(),other=randomUUID(),request=randomUUID();
const leads={first:randomUUID(),second:randomUUID(),waiting:randomUUID(),unassigned:randomUUID(),foreign:randomUUID()};
const foreignToken=randomBytes(32).toString('base64url');
let networkCalls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{networkCalls++;throw Error('External provider prohibited');};
const form=lead=>{const data=new FormData();if(lead!==undefined)data.set('lead',lead);return data;};
async function invoke(role,work){const context={cookies:role?{'asvo-demo':role}:{},effects:[]};return requestContext.run(context,async()=>({value:await work(),effects:context.effects}));}
const snapshot=async(db=sql)=>({links:await db`select * from outing_brief_links order by digest`,audit:await db`select * from audit order by id`,
 mail:await db`select * from registration_mail_outbox order by id`,demo:await db`select * from demo_mail order by id`});
async function failure(work,{field=false,general=true,role='general'}={}){
 const before=await snapshot(),response=await invoke(role,work);
 assert.notEqual(response.value.saved,true);assert.equal(response.value.link,undefined);assert.equal(response.value.destination,undefined);assert.equal(response.effects.length,0);
 if(field)assert.ok(response.value.fieldErrors?.lead);else assert.equal(response.value.fieldErrors,undefined);
 if(general)assert.ok(response.value.error);else assert.equal(response.value.error,undefined);
 assert.deepEqual(await snapshot(),before);return response.value;
}
async function generated(work){const response=await invoke('general',work);assert.equal(response.value.saved,true);assert.equal(typeof response.value.link,'string');
 const link=new URL(response.value.link);assert.equal(link.origin,'http://localhost:3031');assert.match(link.pathname,/^\/resumen-salida\/[A-Za-z0-9_-]{43}$/);
 assert.deepEqual(response.effects,[{path:`/coordinacion/salidas/${outing}/resumen`,type:undefined}]);
 const token=link.pathname.split('/').at(-1);assert.ok(await briefAccess(token));return token;
}
try{
 await sql`insert into grants(subject,role,unit)values(${demoCoordinator},'unidad','BRIF'),(${demoAdmin},'admin','')`;
 await sql`insert into requests(id,organization,activity)values(${request},'DEMO ficticio','Prueba local')`;
 for(const [id,unit]of [[outing,'BRIF'],[other,'UEA']])await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status)values(${id},${request},'DEMO enlaces','Local ficticio',${unit},'2035-01-10','2035-01-12',false,10,'abierta')`;
 let number=0;
 for(const [name,id]of Object.entries(leads)){
  const person=randomUUID(),identification=String(899000000+number++);await sql`insert into volunteers(id,identification,name,surname,email)values(${person},${identification},'Persona','Ficticia','person@example.test')`;
  await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${id},${name==='foreign'?other:outing},${person},${identification},'2035-01-10','2035-01-12',${name==='waiting'?'espera':'confirmada'},${sql.json({assigned70:name!=='unassigned'})})`;
 }
 await sql`insert into outing_brief_links(digest,outing_id,lead_registration_id,created_by)values(${digest(foreignToken)},${other},${leads.foreign},'fictitious-fixture')`;
 const initial=await snapshot();
 await failure(()=>generateBrief('invalid',{},form('invalid')),{field:true});
 await failure(()=>revokeBrief('invalid'));
 await failure(()=>generateBrief(outing,{},form()),{field:true,general:false});
 await failure(()=>generateBrief(outing,{},form('invalid')),{field:true,general:false});
 for(const role of [null,'admin']){
  await failure(()=>generateBrief(outing,{},form(leads.first)),{role});
  await failure(()=>revokeBrief(outing),{role});
 }
 await failure(()=>generateBrief(other,{},form(leads.foreign)));await failure(()=>revokeBrief(other));
 await failure(()=>generateBrief(randomUUID(),{},form(leads.first)));await failure(()=>revokeBrief(randomUUID()));
 for(const lead of [randomUUID(),leads.waiting,leads.unassigned,leads.foreign])await failure(()=>generateBrief(outing,{},form(lead)));
 for(const status of ['borrador','cancelada']){await sql`update outings set status=${status} where id=${outing}`;await failure(()=>generateBrief(outing,{},form(leads.first)));}
 await sql`update outings set status='abierta' where id=${outing}`;
 const first=await generated(()=>generateBrief(outing,{},form(leads.first)));
 const second=await generated(()=>compatible.generateBrief(outing,{},form(leads.second)));
 assert.ok(await briefAccess(first));assert.ok(await briefAccess(second));
 const [{seconds}]=await sql`select extract(epoch from(expires_at-clock_timestamp()))::integer seconds from outing_brief_links where digest=${digest(first)}`;
 assert.ok(seconds>=7*24*60*60-60 && seconds<=7*24*60*60,'Keep the existing seven-day lifetime');
 const replacement=await generated(()=>generateBrief(outing,{},form(leads.first)));assert.equal(await briefAccess(first),undefined);assert.ok(await briefAccess(second));
 // Same selector value after a concurrent assignment change: general conflict, no replacement.
 await sql`update registrations set details=details-'assigned70' where id=${leads.first}`;
 await failure(()=>generateBrief(outing,{},form(leads.first)));await sql`update registrations set details=details||'{"assigned70":true}'::jsonb where id=${leads.first}`;
 assert.ok(await briefAccess(replacement));
 // Fail after link writes, during audit: revocation + insertion must roll back together.
 await sql.unsafe(`create table asvo_brief_contract_failures(action text primary key);
 create function asvo_brief_contract_failure() returns trigger language plpgsql as $$begin
 if exists(select 1 from asvo_brief_contract_failures f where f.action=NEW.action) then raise exception 'Synthetic brief audit failure'; end if;return NEW;end$$;
 create trigger asvo_brief_contract_failure before insert on audit for each row execute function asvo_brief_contract_failure()`);
 await sql`insert into asvo_brief_contract_failures values('Generó resumen para 70')`;
 await failure(()=>generateBrief(outing,{},form(leads.first)));assert.ok(await briefAccess(replacement));assert.ok(await briefAccess(second));
 await sql`delete from asvo_brief_contract_failures`;
 const retry=await generated(()=>generateBrief(outing,{},form(leads.first)));assert.equal(await briefAccess(replacement),undefined);assert.ok(await briefAccess(retry));
 const concurrent=await Promise.all([invoke('general',()=>generateBrief(outing,{},form(leads.first))),invoke('general',()=>generateBrief(outing,{},form(leads.first)))]);
 assert.ok(concurrent.every(result=>result.value.saved===true&&result.value.link));
 const concurrentTokens=concurrent.map(result=>new URL(result.value.link).pathname.split('/').at(-1));
 assert.equal((await Promise.all(concurrentTokens.map(briefAccess))).filter(Boolean).length,1,'Sequential replacements leave only the last link active');
 assert.equal((await sql`select count(*)::integer n from outing_brief_links where outing_id=${outing} and lead_registration_id=${leads.first} and revoked_at is null`)[0].n,1);
 assert.ok(await briefAccess(second));assert.ok(await briefAccess(foreignToken));
 await sql`insert into asvo_brief_contract_failures values('Revocó enlaces de resumen para 70')`;
 await failure(()=>revokeBrief(outing));assert.ok(await briefAccess(second));
 await sql`delete from asvo_brief_contract_failures`;
 const revoked=await invoke('general',()=>compatible.revokeBrief(outing));assert.deepEqual(revoked.value,{saved:true});
 assert.deepEqual(revoked.effects,[{path:`/coordinacion/salidas/${outing}/resumen`,type:undefined}]);
 assert.equal(await briefAccess(second),undefined);assert.ok(await briefAccess(foreignToken));
 assert.equal((await sql`select count(*)::integer n from outing_brief_links where outing_id=${outing} and revoked_at is null`)[0].n,0);
 const beforeRepeat=await snapshot(),repeat=await invoke('general',()=>revokeBrief(outing));assert.deepEqual(repeat.value,{saved:true});
 const afterRepeat=await snapshot();assert.deepEqual(afterRepeat.links,beforeRepeat.links);assert.equal(afterRepeat.audit.length,beforeRepeat.audit.length+1,'Zero active links is still a valid audited revocation');
 assert.deepEqual(afterRepeat.mail,initial.mail);assert.deepEqual(afterRepeat.demo,initial.demo);assert.equal(networkCalls,0);
 // A closed application connection produces a general error without invalidation or a secret/link payload.
 const observer=postgres(process.env.DATABASE_URL,{max:1});
 try{const before=await snapshot(observer);await sql.end();for(const work of [()=>generateBrief(outing,{},form(leads.first)),()=>revokeBrief(outing)]){
  const response=await invoke('general',work);assert.ok(response.value.error);assert.notEqual(response.value.saved,true);assert.equal(response.value.fieldErrors,undefined);assert.equal(response.value.link,undefined);assert.equal(response.effects.length,0);
 }assert.deepEqual(await snapshot(observer),before);}finally{await observer.end();}
 console.log('OK: enlaces 70 tipados; inválidos/permisos/conflictos sin efectos, payload y vigencia, sustitución por persona, concurrencia, rollback de generación/revocación, reintentos y no-op auditado; sin red ni correo.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
