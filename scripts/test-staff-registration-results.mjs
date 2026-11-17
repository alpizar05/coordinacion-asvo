import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const p=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(p)))return next(p.href,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'strip',sourceUrl:url}),shortCircuit:true};return next(url,c);}});
const {sql,demoCoordinator}=await import('../lib/db.ts');
const actions=await import('../app/actions/registrations.ts');
const compatibleAdd=await import('../app/coordinacion/add-registration-actions.ts');
const compatibleEdit=await import('../app/coordinacion/edit-registration-actions.ts');
const outing=randomUUID(),foreign=randomUUID(),request=randomUUID();
const people=Array.from({length:5},()=>randomUUID());
const form=values=>{const data=new FormData();for(const [key,value]of Object.entries(values))data.set(key,value);return data;};
const addData=person=>form({schedule:'2035-01-10/2035-01-12/true',volunteer:person,starts:'2035-01-10',ends:'2035-01-12',transport:'on',rides:'2',food:'Ficticio'});
async function invoke(role,work){const context={cookies:role?{'asvo-demo':role}:{},effects:[]};return requestContext.run(context,async()=>({value:await work(),effects:context.effects}));}
const snapshot=async()=>({registrations:await sql`select * from registrations order by id`,audit:await sql`select * from audit order by id`,mail:await sql`select * from registration_mail_outbox order by id`,demo:await sql`select * from demo_mail order by id`,links:await sql`select * from links order by digest`});
async function failure(work,role='general'){
 const before=await snapshot(),response=await invoke(role,work);
 assert.notEqual(response.value.saved,true);assert.ok(response.value.error||response.value.fieldErrors);
 assert.equal(response.effects.length,0);assert.deepEqual(await snapshot(),before);return response.value;
}
async function editData(id,food){const loaded=await invoke('general',()=>actions.loadEditableRegistration(id));assert.ok(loaded.value.data);return form({version:loaded.value.data.version,starts:'2035-01-10',ends:'2035-01-12',transport:'on',rides:'2',food});}
let calls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('Provider prohibited');};
try{
 await sql`insert into grants(subject,role,unit)values(${demoCoordinator},'unidad','BRIF')`;
 await sql`insert into requests(id,organization,activity)values(${request},'DEMO resultados de inscripción','Ficticio')`;
 for(const[id,unit]of[[outing,'BRIF'],[foreign,'UEA']])await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${id},${request},'DEMO resultados','Local ficticio',${unit},'2035-01-10','2035-01-12',true,1,'abierta',false)`;
 for(const[id,index]of people.map((id,i)=>[id,i])){
  await sql`insert into volunteers(id,identification,name,surname,email,units)values(${id},${'8'+String(index).padStart(8,'0')},'Persona','Ficticia',${'person'+index+'@example.test'},array['Voluntariado General','BRIF'])`;
  await sql`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)values(${id},'DEMO','DEMO','2035-01-01','2035-12-31',now())`;
 }
 await failure(()=>actions.addRegistration(outing,addData(people[0])),null);
 await failure(()=>actions.addRegistration(foreign,addData(people[0])));
 const malformed=await failure(()=>actions.addRegistration(outing,form({schedule:'2035-01-10/2035-01-12/true',volunteer:'bad',starts:'',ends:'',transport:'on',rides:'-1'})));
 for(const field of ['volunteer','starts','ends','rides'])assert.ok(malformed.fieldErrors[field]);
 const missing=await failure(()=>actions.addRegistration(outing,addData(randomUUID())));
 assert.ok(missing.error);assert.ok(missing.fieldErrors.volunteer);
 const added=await invoke('general',()=>actions.addRegistration(outing,addData(people[0])));
 assert.equal(added.value.saved,true);assert.equal(added.value.status,'revisión');assert.equal(added.effects.length,3);
 const waiting=await invoke('general',()=>compatibleAdd.addRegistration(outing,addData(people[1])));
 assert.equal(waiting.value.saved,true);assert.equal(waiting.value.status,'espera');
 await failure(()=>actions.addRegistration(outing,addData(people[0])));
 const beforeRace=await snapshot();
 const raced=await Promise.all([invoke('general',()=>actions.addRegistration(outing,addData(people[2]))),invoke('general',()=>actions.addRegistration(outing,addData(people[2])))]);
 assert.equal(raced.filter(r=>r.value.saved===true).length,1);assert.equal(raced.filter(r=>r.value.error).length,1);
 assert.equal((await sql`select count(*)::int n from registrations where volunteer_id=${people[2]}`)[0].n,1);
 assert.equal((await snapshot()).demo.length,beforeRace.demo.length+1);
 assert.equal((await snapshot()).audit.length,beforeRace.audit.length+2);
 const [entry]=await sql`select id from registrations where outing_id=${outing} and volunteer_id=${people[0]}`;
 const [waitEntry]=await sql`select id from registrations where outing_id=${outing} and volunteer_id=${people[1]}`;
 const edit=await editData(entry.id,'Cambio ficticio');
 const edited=await invoke('general',()=>actions.saveEditedRegistration(entry.id,edit));assert.equal(edited.value.saved,true);
 assert.equal((await sql`select status from registrations where id=${entry.id}`)[0].status,'revisión');
 await failure(()=>actions.saveEditedRegistration(entry.id,edit));
 await failure(()=>actions.saveEditedRegistration(entry.id,edit),null);
 assert.equal((await invoke('general',async()=>compatibleEdit.saveEditedRegistration(waitEntry.id,await editData(waitEntry.id,'Cambio en espera')))).value.saved,true);
 assert.equal((await sql`select status from registrations where id=${waitEntry.id}`)[0].status,'espera');
 // Historical confirmed edit behavior: same dates retain confirmation; dates changed return to review.
 await sql`update registrations set status='confirmada' where id=${entry.id}`;
 assert.equal((await invoke('general',async()=>actions.saveEditedRegistration(entry.id,await editData(entry.id,'Cambio confirmado')))).value.saved,true);
 assert.equal((await sql`select status from registrations where id=${entry.id}`)[0].status,'confirmada');
 const changed=await editData(entry.id,'Cambio de fechas');changed.set('starts','2035-01-11');
 assert.equal((await invoke('general',()=>actions.saveEditedRegistration(entry.id,changed))).value.saved,true);
 assert.equal((await sql`select status from registrations where id=${entry.id}`)[0].status,'revisión');
 await sql.unsafe(`create function asvo_staff_results_fail() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit failure'; end$$; create trigger asvo_staff_results_fail before insert on audit for each row execute function asvo_staff_results_fail()`);
 const beforeFailure=await snapshot(),context={cookies:{'asvo-demo':'general'},effects:[]};
 await assert.rejects(()=>requestContext.run(context,()=>actions.addRegistration(outing,addData(people[3]))));
 assert.deepEqual(await snapshot(),beforeFailure);assert.equal(context.effects.length,0);
 const failingEdit=await editData(waitEntry.id,'Debe revertirse');
 await assert.rejects(()=>requestContext.run(context,()=>actions.saveEditedRegistration(waitEntry.id,failingEdit)));
 assert.deepEqual(await snapshot(),beforeFailure);assert.equal(context.effects.length,0);
 await sql.unsafe('drop trigger asvo_staff_results_fail on audit; drop function asvo_staff_results_fail()');
 assert.equal((await invoke('general',()=>actions.addRegistration(outing,addData(people[3])))).value.status,'espera');
 assert.equal((await invoke('general',()=>actions.saveEditedRegistration(waitEntry.id,failingEdit))).value.saved,true);
 // Two edits using the same version: one commit, one stale response; one notification.
 const concurrentEdit=await editData(waitEntry.id,'Edición concurrente'),beforeEdits=await snapshot();
 const edits=await Promise.all([invoke('general',()=>actions.saveEditedRegistration(waitEntry.id,concurrentEdit)),invoke('general',()=>actions.saveEditedRegistration(waitEntry.id,concurrentEdit))]);
 assert.equal(edits.filter(r=>r.value.saved===true).length,1);assert.equal(edits.filter(r=>r.value.error).length,1);
 assert.equal((await snapshot()).audit.length,beforeEdits.audit.length+1);assert.equal((await snapshot()).demo.length,beforeEdits.demo.length+1);
 // A response can fail after commit: preserve the persisted operation, do not claim rollback.
 const postCommit={cookies:{'asvo-demo':'general'},effects:{push(){throw Error('Synthetic postcommit invalidation failure');}}};
 const beforePostAdd=await snapshot();
 await assert.rejects(()=>requestContext.run(postCommit,()=>actions.addRegistration(outing,addData(people[4]))));
 const afterPostAdd=await snapshot();
 assert.equal(afterPostAdd.registrations.length,beforePostAdd.registrations.length+1);
 assert.equal(afterPostAdd.audit.length,beforePostAdd.audit.length+2);assert.equal(afterPostAdd.demo.length,beforePostAdd.demo.length+1);
 await failure(()=>actions.addRegistration(outing,addData(people[4])));
 const postEdit=await editData(waitEntry.id,'Edición guardada antes del fallo'),beforePostEdit=await snapshot();
 await assert.rejects(()=>requestContext.run(postCommit,()=>actions.saveEditedRegistration(waitEntry.id,postEdit)));
 const afterPostEdit=await snapshot();assert.equal(afterPostEdit.audit.length,beforePostEdit.audit.length+1);assert.equal(afterPostEdit.demo.length,beforePostEdit.demo.length+1);
 assert.equal((await sql`select details->>'alimentacion' food from registrations where id=${waitEntry.id}`)[0].food,'Edición guardada antes del fallo');
 await failure(()=>actions.saveEditedRegistration(waitEntry.id,postEdit));
 assert.equal((await snapshot()).mail.length,0);assert.equal(calls,0);
 console.log('OK: fallo posterior al commit conserva alta/edición, auditoría y aviso; reintentos son duplicado/versión obsoleta sin avisos extra.');
 console.log('OK: alta revisión/espera, errores conjuntos, permisos, adaptadores, duplicado concurrente, edición/estados/versiones, rollback y reintento sin avisos duplicados; cero proveedores reales.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
