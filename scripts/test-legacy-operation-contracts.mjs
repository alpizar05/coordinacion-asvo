import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const p=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(p)))return next(p.href,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'strip',sourceUrl:url}),shortCircuit:true};return next(url,c);}});
const {sql,demoCoordinator,demoAdmin}=await import('../lib/db.ts');
const outings=await import('../app/actions/outings.ts'),entries=await import('../app/actions/registrations.ts'),series=await import('../app/actions/series.ts');
const {privateAction}=await import('../app/public-actions.ts');
const {managePhoto}=await import('../app/photo-actions.ts');
const legacy=await import('../app/staff-actions.ts');
const {manageOutingRecord}=await import('../lib/staff-outing-management.ts');
const {manageLegacyEntry}=await import('../lib/legacy-entry-management.ts');
const {outingSeriesVersion}=await import('../lib/outing-editor.ts');
const postgres=(await import('postgres')).default;
let calls=0,serial=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('Real provider prohibited');};
const form=values=>{const f=new FormData();for(const[k,v]of Object.entries(values))for(const item of Array.isArray(v)?v:[v])f.append(k,item);return f;};
const user={subject:demoCoordinator,grants:[{role:'general',unit:''}]};
async function fixture(status='abierta',past=false){const id=randomUUID(),request=randomUUID();await sql`insert into requests(id,organization,activity)values(${request},'DEMO compatibilidad','Ficticia')`;await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${id},${request},'DEMO antigua','Local','Voluntariado General',${past?'2000-01-01':'2035-01-10'},${past?'2000-01-02':'2035-01-12'},true,3,${status},false)`;return {id,request};}
async function participant(id){const person=randomUUID(),entry=randomUUID(),identification=String(870000000+serial++);await sql`insert into volunteers(id,identification,name,surname,email)values(${person},${identification},'Persona','Ficticia',${person+'@example.test'})`;await sql`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)values(${person},'DEMO','DEMO','1990-01-01','2040-01-01',now())`;await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${entry},${id},${person},${identification},'2035-01-10','2035-01-12','revisión','{}'::jsonb)`;return entry;}
async function invoke(work,role='general'){const ctx={cookies:role?{'asvo-demo':role}:{},effects:[]};return requestContext.run(ctx,async()=>{try{return {value:await work(),effects:ctx.effects};}catch(error){if(error.message.startsWith('REDIRECT:'))return {url:new URL(error.message.slice(9),'http://localhost:3031'),effects:ctx.effects};throw error;}});}
const snapshot=async(db=sql)=>({outings:await db`select * from outings order by id`,requests:await db`select * from requests order by id`,entries:await db`select * from registrations order by id`,photos:await db`select * from outing_photos order by id`,audit:await db`select * from audit order by id`,mail:await db`select * from registration_mail_outbox order by id`,demo:await db`select * from demo_mail order by id`});
async function rejected(work,role='general',db=sql){const before=await snapshot(db),r=await invoke(work,role);assert.deepEqual(r.effects,[]);if(r.url){assert.ok(r.url.searchParams.get('error'));assert.equal(r.url.searchParams.has('confirmacion'),false);assert.equal(r.url.searchParams.has('gestionada'),false);}else{assert.notEqual(r.value.saved,true);assert.ok(r.value.error||r.value.fieldErrors);}assert.deepEqual(await snapshot(db),before);return r;}
try{
 await sql`insert into grants(subject,role,unit)values(${demoCoordinator},'general',''),(${demoAdmin},'admin','')`;
 const o=await fixture();
 await rejected(()=>outings.manageOuting(randomUUID(),form({action:'datos'})));
 const invalid=await rejected(()=>outings.manageOuting('invalid',form({action:'datos'})));assert.equal(invalid.url.pathname,'/coordinacion/convocatorias');
 await rejected(()=>entries.manageEntry('invalid',true,'',form({action:'confirmar'})));
 await rejected(()=>managePhoto('invalid',form({action:'editar'})));
 const privateInvalid=await rejected(()=>privateAction('bad/path?value=1',form({action:'editar'})));assert.equal(privateInvalid.url.pathname,'/privado/invalido');
 for(const role of [null,'admin']){await rejected(()=>outings.manageOuting(o.id,form({action:'cupo',capacity:'4',reason:'DEMO'})),role);await rejected(()=>series.updateAutomaticCollection(o.request,form({})),role);}
 const multiple=await sql.begin(tx=>manageOutingRecord(tx,o.id,form({action:'cupo',capacity:'0'}),user));assert.deepEqual(Object.keys(multiple.fieldErrors).sort(),['capacity','reason']);
 const dates=await sql.begin(tx=>manageOutingRecord(tx,o.id,form({action:'fechas',starts:'bad',ends:'bad',mode:'bad'}),user));assert.deepEqual(Object.keys(dates.fieldErrors).sort(),['ends','mode','starts']);
 const visibility=await sql.begin(tx=>manageOutingRecord(tx,o.id,form({action:'visibilidad',visibility:'bad',registrationDeadline:'bad'}),user));assert.deepEqual(Object.keys(visibility.fieldErrors).sort(),['registrationDeadline','visibility']);
 const fields=await sql.begin(tx=>manageOutingRecord(tx,o.id,form({action:'datos',personal:['title','location','unit']}),user));assert.deepEqual(Object.keys(fields.fieldErrors).sort(),['location','title','unit']);
 const invalidVisibility=await rejected(()=>outings.manageOuting(o.id,form({action:'visibilidad',visibility:'bad',registrationDeadline:'bad'})));assert.equal(invalidVisibility.url.hash,'#visibilidad');
 const wrong=form({action:'cupo',capacity:'0'}),a=await rejected(()=>outings.manageOuting(o.id,wrong)),b=await rejected(()=>legacy.manageOuting(o.id,wrong));assert.equal(a.url.href,b.url.href);assert.equal(a.url.hash,'#cupos');assert.ok(a.url.searchParams.get('error').includes('motivo'));assert.ok(a.url.searchParams.get('error').includes('cupo entre'));
 const auditBefore=(await snapshot()).audit.length;const unchanged=await invoke(()=>outings.manageOuting(o.id,form({action:'fechas',starts:'2035-01-10',ends:'2035-01-12',mode:'flexible'})));assert.equal(unchanged.url.searchParams.get('confirmacion'),'salida');assert.equal((await snapshot()).audit.length,auditBefore);
 const edit=form({action:'datos',personal:['title','location','unit'],title:'DEMO modificada',location:'Local',unit:'Voluntariado General'});
 await sql`create function fail_legacy_audit()returns trigger language plpgsql as $$begin raise exception 'Synthetic legacy failure';end$$`;await sql`create trigger fail_legacy_audit before insert on audit for each row execute function fail_legacy_audit()`;
 const failed=await rejected(()=>outings.manageOuting(o.id,edit));assert.ok(!failed.url.searchParams.get('error').includes('Synthetic'));
 await sql`drop trigger fail_legacy_audit on audit`;await sql`drop function fail_legacy_audit()`;
 const retry=await invoke(()=>outings.manageOuting(o.id,edit));assert.equal(retry.url.searchParams.get('confirmacion'),'salida');assert.equal((await sql`select title from outings where id=${o.id}`)[0].title,'DEMO modificada');
 const entry=await participant(o.id);const conflict=await rejected(()=>outings.manageOuting(o.id,form({action:'datos',personal:['title','location','unit'],title:'DEMO',location:'Local',unit:'UEA'})));assert.equal(conflict.url.searchParams.get('unidadPropuesta'),'UEA');
 const missing=await sql.begin(tx=>manageLegacyEntry(tx,randomUUID(),true,'',form({action:'confirmar'}),user));assert.ok(missing.error);assert.equal(missing.saved,undefined);
 const missingReason=await sql.begin(tx=>manageLegacyEntry(tx,entry,true,'',form({action:'cancelar'}),user));assert.ok(missingReason.fieldErrors.reason);assert.equal(missingReason.flushUpdates,undefined);
 const filtered=await rejected(()=>entries.manageEntry(entry,true,'estado=revisión&unidad=UEA&desde=2035-01-01',form({action:'cancelar'})));assert.equal(filtered.url.searchParams.get('unidad'),'UEA');assert.equal(filtered.url.hash,'#inscripcion-'+entry);
 const confirmed=await invoke(()=>legacy.manageEntry(entry,true,'estado=revisión&unidad=UEA',form({action:'confirmar'})));assert.equal(confirmed.url.searchParams.get('gestionada'),entry);assert.equal(confirmed.url.searchParams.get('estado'),'todos');await rejected(()=>entries.manageEntry(entry,true,'',form({action:'confirmar'})));
 // Preserve committed FIFO promotions and post-commit dispatch eligibility on a declined reopen.
 const fifoOuting=await fixture();const cancelled=await participant(fifoOuting.id),waiting=await participant(fifoOuting.id);
 await sql`update outings set capacity=1 where id=${fifoOuting.id}`;await sql`update registrations set status=case when id=${cancelled} then 'cancelada por coordinación' else 'espera' end where outing_id=${fifoOuting.id}`;
 const fifo=await sql.begin(tx=>manageLegacyEntry(tx,cancelled,true,'',form({action:'confirmar'}),user));assert.ok(fifo.error);assert.notEqual(fifo.saved,true);assert.equal(fifo.flushUpdates,true);assert.equal((await sql`select status from registrations where id=${waiting}`)[0].status,'revisión');assert.equal((await sql`select count(*)::int n from demo_mail where registration_id=${waiting}`)[0].n,1);
 // Series wrapper preserves field failures, concurrency errors and success redirect.
 const seriesFields=await rejected(()=>series.updateAutomaticCollection(o.request,form({})));assert.ok(seriesFields.value.fieldErrors.apply);assert.ok(seriesFields.value.fieldErrors.confirm);
 const common=form({apply:'title',title:'DEMO serie',confirm:'on',version:await outingSeriesVersion(sql,o.request),block:o.id,editableBlock:o.id});
 const shared=await invoke(()=>legacy.updateAutomaticCollection(o.request,common));assert.equal(shared.url.searchParams.get('guardado'),'1');await rejected(()=>series.updateAutomaticCollection(o.request,common));
 // Photo wrapper aggregates validation and keeps successful gallery commits idempotent.
 const badPhoto=await rejected(()=>managePhoto(o.id,form({action:'editar',photoId:'bad',alt:'',credit:'x'.repeat(151)})));assert.equal(badPhoto.url.hash,'#fotos');assert.ok(badPhoto.url.searchParams.get('error').includes('descripción'));assert.ok(badPhoto.url.searchParams.get('error').includes('crédito'));
 const source=await fixture(),photo=randomUUID();await sql`insert into outing_photos(id,outing_id,position,alt,credit,thumbnail,display_image)values(${photo},${source.id},1,'Ficticia','DEMO',${Buffer.from('fictitious')},${Buffer.from('fictitious')})`;
 const copy=form({action:'galeria',photoId:photo,alt:'Galería',credit:'DEMO',photoOperation:randomUUID()});const copied=await invoke(()=>managePhoto(o.id,copy));assert.equal(copied.url.searchParams.get('confirmacion'),'foto');await invoke(()=>managePhoto(o.id,copy));assert.equal((await sql`select count(*)::int n from outing_photos where outing_id=${o.id}`)[0].n,1);
 const deleted=await fixture();await rejected(()=>outings.manageOuting(deleted.id,form({action:'eliminar'})));const deletion=await invoke(()=>outings.manageOuting(deleted.id,form({action:'eliminar',confirmDelete:'on'})));assert.equal(deletion.url.pathname,'/coordinacion/convocatorias');assert.equal(deletion.url.searchParams.get('confirmacion'),'eliminada');
 const completed=await fixture('abierta',true);const completion=await invoke(()=>outings.manageOuting(completed.id,form({action:'completar',confirmCompleted:'on'})));assert.equal(completion.url.searchParams.get('completada'),'1');await rejected(()=>outings.manageOuting(completed.id,form({action:'cupo',capacity:'5',reason:'DEMO'})));
 const cancellation=await invoke(()=>outings.manageOuting(o.id,form({action:'cancelar-salida',reason:'Motivo ficticio'})));assert.equal(cancellation.url.searchParams.get('confirmacion'),'cancelada');assert.equal((await sql`select status from registrations where id=${entry}`)[0].status,'cancelada por coordinación');
 assert.equal(calls,0);
 const observer=postgres(process.env.DATABASE_URL,{max:1});try{await sql.end();await rejected(()=>outings.manageOuting(o.id,edit),'general',observer);await rejected(()=>entries.manageEntry(entry,true,'',form({action:'confirmar'})),'general',observer);await rejected(()=>series.updateAutomaticCollection(o.request,common),'general',observer);await rejected(()=>managePhoto(o.id,copy),'general',observer);}finally{await observer.end();}
 console.log('OK: contratos legacy explícitos, errores múltiples, redirects compatibles sin confirmaciones falsas, rollback/reintento, no-op, conflictos de unidad/serie, foto idempotente y terminales; sin red real.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
