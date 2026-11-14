import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const p=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(p)))return next(p.href,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'strip',sourceUrl:url}),shortCircuit:true};return next(url,c);}});
const {sql,demoCoordinator,demoAdmin}=await import('../lib/db.ts');
const {saveHomepageFeature}=await import('../lib/outing-series.ts');
const {setHomepageFeature}=await import('../app/actions/series.ts');
const legacy=await import('../app/staff-actions.ts');
const {homepageFeature}=await import('../lib/homepage-feature.ts');
const {listedOutings}=await import('../lib/catalog.ts');
const postgres=(await import('postgres')).default;
let networkCalls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{networkCalls++;throw Error('Provider prohibited');};
const data=(action='destacar')=>{const form=new FormData();form.set('action',action);return form;};
async function invoke(work,role='general'){
 const ctx={cookies:role?{'asvo-demo':role}:{},effects:[]};
 return requestContext.run(ctx,async()=>{try{await work();assert.fail('Expected compatible redirect');}catch(error){if(!error.message.startsWith('REDIRECT:'))throw error;return {url:new URL(error.message.slice(9),'http://localhost:3031'),effects:ctx.effects};}});
}
const snapshot=async(db=sql)=>({feature:await db`select * from homepage_feature`,audit:await db`select * from audit order by id`,
 mail:await db`select * from registration_mail_outbox order by id`,demo:await db`select * from demo_mail order by id`});
async function rejected(work,role='general',db=sql){const before=await snapshot(db),result=await invoke(work,role);assert.ok(result.url.searchParams.get('destacadaError'));assert.equal(result.url.searchParams.has('confirmacion'),false);assert.equal(result.url.hash,'#destacada');assert.deepEqual(result.effects,[]);assert.deepEqual(await snapshot(db),before);return result;}
async function saved(work,clear=false){const result=await invoke(work);assert.equal(result.url.searchParams.get('confirmacion'),clear?'automatica':'destacada');assert.equal(result.url.searchParams.has('destacadaError'),false);assert.equal(result.url.hash,'#destacada');assert.deepEqual(result.effects,[{path:'/',type:undefined}]);return result;}
const request=randomUUID(),secondRequest=randomUUID(),first=randomUUID(),second=randomUUID(),foreign=randomUUID();
try{
 await sql`insert into grants(subject,role,unit)values(${demoCoordinator},'unidad','BRIF'),(${demoAdmin},'admin','')`;
 for(const id of [request,secondRequest])await sql`insert into requests(id,organization,activity)values(${id},'DEMO portada','Prueba local')`;
 for(const [id,req,unit,offset]of [[first,request,'BRIF',10],[second,request,'BRIF',20],[foreign,secondRequest,'UEA',5]])await sql`insert into outings(id,request_id,title,location,unit,starts,ends,registration_deadline,flexible,capacity,status,listed)
 values(${id},${req},'DEMO portada','Ficticio',${unit},(clock_timestamp() at time zone 'America/Costa_Rica')::date+${offset}::int,(clock_timestamp() at time zone 'America/Costa_Rica')::date+${offset}::int+1,(clock_timestamp() at time zone 'America/Costa_Rica')::date,false,3,'abierta',true)`;
 const initial=await snapshot();
 // Explicit service result, including denial and eligibility; no text interpretation.
 const user={subject:demoCoordinator,grants:[{role:'unidad',unit:'BRIF'}]};
 const denied=await sql.begin(tx=>saveHomepageFeature(tx,'outing',first,null,false));assert.ok(denied.error);assert.notEqual(denied.saved,true);assert.equal(denied.fieldErrors,undefined);
 const invalid=await rejected(()=>setHomepageFeature('outing','invalid',data()));assert.equal(invalid.url.pathname,'/coordinacion/convocatorias');
 const badKind=await rejected(()=>setHomepageFeature('invalid',first,data()));assert.equal(badKind.url.pathname,'/coordinacion/convocatorias');
 for(const role of [null,'admin'])await rejected(()=>setHomepageFeature('outing',first,data()),role);
 await rejected(()=>setHomepageFeature('outing',foreign,data()));await rejected(()=>setHomepageFeature('outing',randomUUID(),data()));
 for(const status of ['borrador','confirmada','cancelada','completada']){await sql`update outings set status=${status} where id=${first}`;await rejected(()=>setHomepageFeature('outing',first,data()));}
 await sql`update outings set status='abierta',listed=false where id=${first}`;await rejected(()=>setHomepageFeature('outing',first,data()));
 await sql`update outings set listed=true,registration_deadline=(clock_timestamp() at time zone 'America/Costa_Rica')::date-1 where id=${first}`;
 const expired=await sql.begin(tx=>saveHomepageFeature(tx,'outing',first,user,false));assert.ok(expired.error);assert.equal(expired.fieldErrors,undefined);
 await rejected(()=>setHomepageFeature('outing',first,data()));
 await sql`update outings set registration_deadline=(clock_timestamp() at time zone 'America/Costa_Rica')::date where id=${first}`;
 await saved(()=>setHomepageFeature('outing',first,data()));assert.equal((await homepageFeature()).outing_id,first);
 const auditCount=(await snapshot()).audit.length;await saved(()=>legacy.setHomepageFeature('outing',first,data()));assert.equal((await snapshot()).audit.length,auditCount+1,'Repeated valid selection retains audit behavior');
 // A removed selection is idempotent; clearing another candidate cannot remove the current one.
 const beforeNoop=(await snapshot()).audit.length;await saved(()=>setHomepageFeature('outing',second,data('retirar')),true);assert.equal((await homepageFeature()).outing_id,first);assert.equal((await snapshot()).audit.length,beforeNoop);
 await saved(()=>setHomepageFeature('outing',first,data('retirar')),true);assert.equal(await homepageFeature(),undefined);
 const afterClear=(await snapshot()).audit.length;await saved(()=>setHomepageFeature('outing',first,data('retirar')),true);assert.equal((await snapshot()).audit.length,afterClear);
 // Series eligibility uses any public block, but authorization still covers every block.
 await sql`update outings set listed=false where id=${first}`;await saved(()=>setHomepageFeature('request',request,data()));assert.equal((await homepageFeature()).request_id,request);
 await sql`update outings set unit='UEA' where id=${first}`;await rejected(()=>setHomepageFeature('request',request,data()));await sql`update outings set unit='BRIF',listed=true where id=${first}`;
 // Atomic audit failure: preserve previous manual selection and allow a clean retry.
 await sql`create function fail_feature_audit()returns trigger language plpgsql as $$begin if NEW.action in ('Destacó convocatoria en portada','Retiró convocatoria destacada') then raise exception 'Synthetic feature failure';end if;return NEW;end$$`;
 await sql`create trigger fail_feature_audit before insert on audit for each row execute function fail_feature_audit()`;
 const failed=await rejected(()=>setHomepageFeature('outing',first,data()));assert.ok(!failed.url.searchParams.get('destacadaError').includes('Synthetic'));
 await rejected(()=>setHomepageFeature('request',request,data('retirar')));
 await sql`drop trigger fail_feature_audit on audit`;await sql`drop function fail_feature_audit()`;
 await saved(()=>setHomepageFeature('outing',first,data()));
 // Concurrent commands remain serialized by the existing singleton; only one selection persists.
 const results=await Promise.all([invoke(()=>setHomepageFeature('outing',first,data())),invoke(()=>setHomepageFeature('outing',second,data()))]);assert.ok(results.every(r=>r.url.searchParams.get('confirmacion')==='destacada'));assert.equal((await sql`select count(*)::int n from homepage_feature`)[0].n,1);
 const current=await homepageFeature();assert.ok([first,second].includes(current.outing_id));
 // Current catalog, not the stored manual reference alone, controls expiration/fallback eligibility.
 await sql`update outings set registration_deadline=(clock_timestamp() at time zone 'America/Costa_Rica')::date-1 where id=${current.outing_id}`;
 assert.equal((await listedOutings()).some(o=>o.id===current.outing_id),false);assert.equal((await homepageFeature()).outing_id,current.outing_id);
 const catalog=await listedOutings();assert.equal(catalog[0].id,foreign,'Automatic fallback data remains sorted by nearest start');
 await saved(()=>setHomepageFeature('outing',current.outing_id,data('retirar')),true);
 const end=await snapshot();assert.deepEqual(end.mail,initial.mail);assert.deepEqual(end.demo,initial.demo);assert.equal(networkCalls,0);
 const observer=postgres(process.env.DATABASE_URL,{max:1});try{await sql.end();await rejected(()=>setHomepageFeature('outing',first,data()),'general',observer);}finally{await observer.end();}
 console.log('OK: portada tipada, errores generales sin confirmación, permisos/estado/plazo, selección individual/serie, no-op, auditoría atómica, reintento, concurrencia y fallback de catálogo sin correo ni red.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
