import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const p=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(p)))return next(p.href,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'strip',sourceUrl:url}),shortCircuit:true};return next(url,c);}});
const {sql,demoCoordinator,demoAdmin}=await import('../lib/db.ts');
const {createOutingCollection}=await import('../app/actions/series.ts');
const legacy=await import('../app/staff-actions.ts');
const {saveManualSeries}=await import('../lib/outing-series.ts');
const postgres=(await import('postgres')).default;
let calls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('Provider prohibited');};
const form=values=>{const data=new FormData();for(const[k,v]of Object.entries(values))for(const item of Array.isArray(v)?v:[v])data.append(k,item);return data;};
async function outing(unit,status='abierta'){const id=randomUUID(),request=randomUUID();await sql`insert into requests(id,organization,activity)values(${request},'DEMO serie manual','Ficticia')`;await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${id},${request},'DEMO serie manual','Local',${unit},'2035-01-10','2035-01-12',false,3,${status},false)`;return id;}
const snapshot=async(db=sql)=>({collections:await db`select * from outing_collections order by id`,members:await db`select * from outing_collection_members order by collection_id,outing_id`,audit:await db`select * from audit order by id`,mail:await db`select * from registration_mail_outbox order by id`,demo:await db`select * from demo_mail order by id`,outings:await db`select * from outings order by id`});
async function invoke(work,role='general'){const ctx={cookies:role?{'asvo-demo':role}:{},effects:[]};return requestContext.run(ctx,async()=>({result:await work(),effects:ctx.effects}));}
async function failure(data,{role='general',fields,db=sql}={}){const before=await snapshot(db),values=[...data],response=await invoke(()=>createOutingCollection({},data),role);assert.notEqual(response.result.saved,true);assert.equal(response.result.destination,undefined);assert.deepEqual(response.effects,[]);if(fields)assert.deepEqual(Object.keys(response.result.fieldErrors).sort(),fields.sort());else{assert.ok(response.result.error);assert.equal(response.result.fieldErrors,undefined);}assert.deepEqual([...data],values);assert.deepEqual(await snapshot(db),before);return response.result;}
async function created(work){const response=await invoke(work);assert.equal(response.result.saved,true);assert.deepEqual(response.effects,[]);const url=new URL(response.result.destination,'http://localhost:3031');assert.match(url.pathname,/^\/coordinacion\/colecciones\/manuales\/[0-9a-f-]{36}$/);assert.equal(url.searchParams.get('confirmacion'),'serie');const id=url.pathname.split('/').at(-1);assert.ok((await sql`select id from outing_collections where id=${id}`).length);return id;}
try{
 await sql`insert into grants(subject,role,unit)values(${demoCoordinator},'general',''),(${demoAdmin},'admin','')`;
 const first=await outing('BRIF'),second=await outing('UEA','completada');
 await failure(form({name:'',description:'x'.repeat(2001)}),{fields:['name','description','outing']});
 await failure(form({name:['Uno','Dos'],description:['A','B'],outing:'invalid'}),{fields:['name','description','outing']});
 const valid=form({name:'Serie ficticia',description:'Descripción ficticia',outing:[first,first,second]});
 for(const role of [null,'admin'])await failure(valid,{role});
 await failure(form({name:'Selección anterior',outing:randomUUID()}));
 // Service contract carries required ID; unavailable selection is general, not a bare null.
 const user={subject:demoCoordinator,grants:[{role:'general',unit:''}]};
 const before=await snapshot(),missing=await sql.begin(tx=>saveManualSeries(tx,[randomUUID()],'Ficticia','',user,true,[]));assert.ok(missing.error);assert.equal(missing.saved,undefined);assert.deepEqual(await snapshot(),before);
 // Failure after inserts must roll back collection, membership and audit together.
 await sql`create function fail_manual_series_audit()returns trigger language plpgsql as $$begin if NEW.action='Creó colección de salidas' then raise exception 'Synthetic manual series failure';end if;return NEW;end$$`;
 await sql`create trigger fail_manual_series_audit before insert on audit for each row execute function fail_manual_series_audit()`;
 const failed=await failure(valid);assert.ok(!failed.error.includes('Synthetic'));
 await sql`drop trigger fail_manual_series_audit on audit`;await sql`drop function fail_manual_series_audit()`;
 const id=await created(()=>createOutingCollection({},valid));
 assert.deepEqual((await sql`select outing_id from outing_collection_members where collection_id=${id} order by outing_id`).map(r=>r.outing_id),[first,second].sort());
 assert.equal((await sql`select count(*)::int n from audit where target=${id} and action='Creó colección de salidas'`)[0].n,1);
 // Compatibility adapter remains active; deliberate repeated valid creation keeps its old semantics.
 const repeated=await created(()=>legacy.createOutingCollection({},valid));assert.notEqual(id,repeated);assert.equal((await sql`select count(*)::int n from outing_collections where name='Serie ficticia'`)[0].n,2);
 const concurrent=await Promise.all([created(()=>createOutingCollection({},form({name:'Concurrente A',outing:first}))),created(()=>createOutingCollection({},form({name:'Concurrente B',outing:first})))]);assert.notEqual(concurrent[0],concurrent[1]);
 // Current unit is authoritative: no new version field is added to this creation form.
 await sql`delete from grants where subject=${demoCoordinator}`;await sql`insert into grants(subject,role,unit)values(${demoCoordinator},'unidad','BRIF')`;
 await failure(form({name:'Ajena',outing:[first,second]}));
 await sql`update outings set unit='UEA' where id=${first}`;await failure(form({name:'Selección obsoleta',outing:first}));await sql`update outings set unit='BRIF' where id=${first}`;
 const allowed=await created(()=>createOutingCollection({},form({name:'Mi unidad',outing:first})));assert.equal((await sql`select count(*)::int n from outing_collection_members where collection_id=${allowed}`)[0].n,1);
 const emptyMail=await sql`select count(*)::int n from registration_mail_outbox`;assert.equal(emptyMail[0].n,0);assert.equal((await sql`select count(*)::int n from demo_mail`)[0].n,0);assert.equal(calls,0);
 const observer=postgres(process.env.DATABASE_URL,{max:1});try{await sql.end();await failure(form({name:'Sin conexión',outing:first}),{db:observer});}finally{await observer.end();}
 console.log('OK: serie manual tipada, errores múltiples, permisos/selección actual, rollback y reintento, membresía sin repetidos, concurrencia y repetición histórica explícita; sin red ni correo.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
