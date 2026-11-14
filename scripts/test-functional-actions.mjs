import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import sharp from 'sharp';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const p=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(p)))return next(p.href,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'strip',sourceUrl:url}),shortCircuit:true};return next(url,c);}});
const {sql,demoCoordinator,demoAdmin}=await import('../lib/db.ts');
const legacy=await import('../app/staff-actions.ts');
const volunteers=await import('../app/actions/volunteers.ts');const outings=await import('../app/actions/outings.ts');const series=await import('../app/actions/series.ts');
const registrations=await import('../app/actions/registrations.ts');const communications=await import('../app/actions/communications.ts');const reports=await import('../app/actions/reports.ts');const session=await import('../app/actions/session.ts');
const oldRegistrations=await import('../app/coordinacion/add-registration-actions.ts');const oldReport=await import('../app/resumen-salida/[token]/informe/actions.ts');
const {outingSeriesVersion}=await import('../lib/outing-editor.ts');const {activeOutingInvitation}=await import('../lib/outing-invitations.ts');const {briefAccess}=await import('../lib/outing-brief.ts');
const {labourOptions,activityOptions}=await import('../lib/outing-report-options.ts');
const originalFetch=globalThis.fetch;let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('Proveedor real prohibido');};
const form=values=>{const f=new FormData();for(const[k,v]of Object.entries(values))for(const value of Array.isArray(v)?v:[v])f.append(k,value);return f;};
const context=role=>({cookies:role?{'asvo-demo':role}:{},effects:[],cookieWrites:[]});
async function invoke(role,work){const ctx=context(role);return requestContext.run(ctx,async()=>{try{return {value:await work(),effects:ctx.effects,cookies:ctx.cookieWrites};}catch(error){if(error.message.startsWith('REDIRECT:'))return {redirect:error.message.slice(9),effects:ctx.effects,cookies:ctx.cookieWrites};throw error;}});}
async function entryForm(id,action,extra={}){const [row]=await sql`select md5(to_jsonb(r)::text) as version,o.starts::text,o.ends::text,o.flexible from registrations r join outings o on o.id=r.outing_id where r.id=${id}`;return form({version:row.version,schedule:`${row.starts}/${row.ends}/${row.flexible}`,action,...extra});}
try{
 await sql`insert into grants(subject,role,unit)values(${demoAdmin},'admin',''),(${demoCoordinator},'general','')`;
 const person=randomUUID();await sql`insert into volunteers(id,identification,name,surname,email)values(${person},'892340567','Persona','Ficticia','person@example.test')`;
 await sql`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)values(${person},'DEMO','DEMO','2020-01-01','2040-12-31',clock_timestamp())`;
 // Volunteering: same errors via adapter/canonical action; no revalidation on failure.
 const badProfile=form({name:'',surname:''});const oldBad=await invoke('admin',()=>legacy.editProfile(person,badProfile)),newBad=await invoke('admin',()=>volunteers.editProfile(person,badProfile));assert.deepEqual(oldBad,newBad);assert.ok(newBad.value.fieldErrors.name);assert.equal(newBad.effects.length,0);
 assert.ok((await invoke('general',()=>volunteers.editProfile(person,form({name:'Cambio',surname:'Ficticia'})))).value.error);
 const corrected=await invoke('admin',()=>volunteers.editProfile(person,form({name:'Persona',surname:'Ficticia',email:'person@example.test'})));assert.equal(corrected.value.saved,true);assert.deepEqual(corrected.effects.map(e=>e.path),[`/coordinacion/registro/${person}`]);
 // Audit failure rolls back the profile and produces no post-commit revalidation.
 await sql.unsafe(`create function fail_functional_audit()returns trigger language plpgsql as $$begin if NEW.action='Corrigió ficha' then raise exception 'Synthetic audit failure';end if;return NEW;end$$;create trigger fail_functional_audit before insert on audit for each row execute function fail_functional_audit();`);
 const failedContext=context('admin');await assert.rejects(()=>requestContext.run(failedContext,()=>volunteers.editProfile(person,form({name:'No guardar',surname:'Ficticia'}))),/Synthetic/);assert.equal(failedContext.effects.length,0);assert.equal((await sql`select name from volunteers where id=${person}`)[0].name,'Persona');await sql`drop trigger fail_functional_audit on audit`;
 assert.equal((await invoke('general',()=>volunteers.updateVolunteerUnits(person,form({units:[]})))).value.saved,true);assert.ok((await sql`select units from volunteers where id=${person}`)[0].units.includes('Voluntariado General'));
 // Creation and retries keep their transaction/idempotency/photo pipeline, no providers in demo.
 const png=await sharp({create:{width:4,height:4,channels:3,background:'#526a3d'}}).png().toBuffer();
 const creation=form({title:'DEMO funcional',location:'Local ficticio',unit:'Voluntariado General',starts:['2035-01-10','2035-01-17'],ends:['2035-01-12','2035-01-19'],periodId:['first','second'],capacity:'3',action:'publicar',visibility:'publica',registrationDeadline:'2035-01-10',flexible:'on',photoCover:'new-0','photo-0':new File([png],'ficticia.png',{type:'image/png'}),'alt-0':'Portada ficticia','credit-0':'ASVO DEMO','permission-0':'on',photoOperation:randomUUID()});
 const created=await invoke('general',()=>outings.createOuting(creation));assert.equal(created.value.saved,true);assert.deepEqual((await invoke('general',()=>legacy.createOuting(creation))).value,created.value);
 const blocks=await sql`select id,request_id,starts::text,ends::text,flexible from outings where title='DEMO funcional' order by starts`;assert.equal(blocks.length,2);const outing=blocks[0].id,request=blocks[0].request_id;
 assert.equal((await sql`select count(*)::int as n from audit where target=any(${blocks.map(b=>b.id)}::text[])`)[0].n,2);
 assert.equal((await sql`select count(*)::int as n from outing_photos where outing_id=any(${blocks.map(b=>b.id)}::uuid[]) and position=1`)[0].n,2);assert.equal((await sql`select count(*)::int as n from photo_upload_items`)[0].n,0);
 const collection=await invoke('general',()=>series.createOutingCollection({},form({name:'DEMO manual',description:'Ficticia',outing:blocks.map(b=>b.id)})));assert.equal(collection.value.saved,true);
 const common=form({apply:'title',title:'DEMO común',confirm:'on',version:await outingSeriesVersion(sql,request),block:blocks.map(b=>b.id),editableBlock:blocks.map(b=>b.id)});
 assert.equal((await invoke('general',()=>series.saveAutomaticCollection(request,common))).value.saved,true);
 const stale=await invoke('general',()=>series.saveAutomaticCollection(request,common));assert.match(stale.value.error,/cambiaron/);assert.deepEqual((await invoke('general',()=>legacy.saveAutomaticCollection(request,common))).value,stale.value);assert.equal(stale.effects.length,0);
 assert.equal((await sql`select count(*)::int as n from outings where request_id=${request} and title='DEMO común'`)[0].n,2);
 // A legacy redirect remains identical, while the active editor uses its existing field-error action.
 const wrongCapacity=form({action:'cupo',reason:'Prueba',capacity:'0'});const a=await invoke('general',()=>outings.manageOuting(outing,wrongCapacity)),b=await invoke('general',()=>legacy.manageOuting(outing,wrongCapacity));assert.equal(a.redirect,b.redirect);assert.ok(a.redirect.endsWith('#cupos'));assert.match(a.redirect,/editar=1/);
 // Add/edit/manage queries and notifications through canonical and compatibility entry points.
 const invalidAdd=form({schedule:'2035-01-10/2035-01-12/true',volunteer:'bad',starts:'',ends:''});const invalid=await invoke('general',()=>registrations.addRegistration(outing,invalidAdd));assert.ok(invalid.value.fieldErrors.volunteer);assert.deepEqual(invalid.value,(await invoke('general',()=>oldRegistrations.addRegistration(outing,invalidAdd))).value);assert.equal(invalid.effects.length,0);
 const added=await invoke('general',()=>registrations.addRegistration(outing,form({schedule:'2035-01-10/2035-01-12/true',volunteer:person,starts:'2035-01-10',ends:'2035-01-12',transport:'on',rides:'2',food:'DEMO'})));assert.equal(added.value.saved,true);assert.ok(added.effects.some(e=>e.path==='/coordinacion/inscripciones'));
 const [entry]=await sql`select id from registrations where outing_id=${outing} and volunteer_id=${person}`;
 const beforeInvalid=(await sql`select count(*)::int as n from demo_mail`)[0].n;
 const missingReason=await invoke('general',async()=>registrations.manageRegistration(entry.id,await entryForm(entry.id,'cancelar')));assert.ok(missingReason.value.fieldErrors.reason);assert.equal(missingReason.effects.length,0);assert.equal((await sql`select count(*)::int as n from demo_mail`)[0].n,beforeInvalid);
 const confirmation=await entryForm(entry.id,'confirmar');assert.equal((await invoke('general',()=>registrations.manageRegistration(entry.id,confirmation))).value.saved,true);assert.ok((await invoke('general',()=>registrations.manageRegistration(entry.id,confirmation))).value.error);
 assert.equal((await sql`select count(*)::int as n from demo_mail`)[0].n,beforeInvalid+1);
 assert.equal((await invoke('general',async()=>registrations.manageRegistration(entry.id,await entryForm(entry.id,'asignar70')))).value.saved,true);
 const detail=await invoke('general',()=>registrations.loadRegistrationDetail(entry.id));assert.equal(detail.value.data.entry.assigned70,true);assert.ok((await invoke('general',()=>registrations.findRegistrationVolunteers(outing,'Persona'))).value.people.some(p=>p.id===person));
 const editable=await invoke('general',()=>registrations.loadEditableRegistration(entry.id));const edited=await invoke('general',()=>registrations.saveEditedRegistration(entry.id,form({version:editable.value.data.version,starts:'2035-01-10',ends:'2035-01-12',transport:'on',rides:'3',food:'DEMO editado'})));assert.equal(edited.value.saved,true);
 // Confirm after any edit that requires review, then assign 70 again if the current policy requires it.
 const [entryState]=await sql`select status from registrations where id=${entry.id}`;
 if(entryState.status!=='confirmada')assert.equal((await invoke('general',async()=>registrations.manageRegistration(entry.id,await entryForm(entry.id,'confirmar')))).value.saved,true);
 assert.equal((await invoke('general',async()=>registrations.manageRegistration(entry.id,await entryForm(entry.id,'asignar70')))).value.saved,true);
 const invitation=await invoke('general',()=>communications.createOutingInvitation(outing,{},form({identification:'892340567'})));assert.equal(invitation.value.saved,true);const invitationToken=new URL(invitation.value.link).searchParams.get('invitacion');assert.ok(await activeOutingInvitation(outing,invitationToken));
 const brief=await invoke('general',()=>communications.generateBrief(outing,{},form({lead:entry.id})));assert.equal(brief.value.saved,true);const token=new URL(brief.value.link).pathname.split('/').at(-1);assert.ok(await briefAccess(token));
 // Report contracts exercise the real service/action and persistence, not substituted business rules.
 const reportSnapshot=async()=>({rows:await sql`select * from outing_reports where outing_id=${outing}`,
   audit:(await sql`select count(*)::int n from audit where target=${outing}`)[0].n,
   mail:(await sql`select count(*)::int n from registration_mail_outbox`)[0].n,
   demo:(await sql`select count(*)::int n from demo_mail`)[0].n});
 async function reportFailure(work,{fields=false}={}){
  const before=await reportSnapshot(),response=await invoke(null,work);
  assert.notEqual(response.value.saved,true);assert.equal(response.value.destination,undefined);assert.equal(response.effects.length,0);
  if(fields)assert.ok(response.value.fieldErrors);else {assert.ok(response.value.error);assert.equal(response.value.fieldErrors,undefined);}
  assert.deepEqual(await reportSnapshot(),before);return response.value;
 }
 const reportBaseline=await reportSnapshot();
 const draft=form({intent:'borrador',version:'new'});
 await reportFailure(()=>reports.submitReport('invalid',{},draft));
 await reportFailure(()=>reports.submitReport('x'.repeat(43),{},draft));
 await sql`update outing_brief_links set expires_at=clock_timestamp()-interval '1 second' where digest=${(await import('../lib/registration.ts')).digest(token)}`;
 await reportFailure(()=>reports.submitReport(token,{},draft));
 await sql`update outing_brief_links set expires_at=clock_timestamp()+interval '7 days' where digest=${(await import('../lib/registration.ts')).digest(token)}`;
 await sql`update registrations set details=details-'assigned70' where id=${entry.id}`;
 await reportFailure(()=>reports.submitReport(token,{},draft));
 await sql`update registrations set details=details||'{"assigned70":true}'::jsonb where id=${entry.id}`;
 await sql`update volunteers set email=null where id=${person}`;
 await reportFailure(()=>reports.submitReport(token,{},draft));
 await sql`update volunteers set email='person@example.test' where id=${person}`;
 const invalidFinal=form({intent:'finalizar',version:'new',roster:entry.id});
 const invalidReport=await reportFailure(()=>reports.submitReport(token,{},invalidFinal),{fields:true});
 for(const key of ['labour','activity','location','starts','ends','actions','host','participants','accuracy'])assert.ok(invalidReport.fieldErrors[key]);
 assert.equal(invalidReport.errors,undefined,'No legacy error mirror');
 const saved=await invoke(null,()=>reports.submitReport(token,{},draft));assert.equal(saved.value.saved,true);
 assert.equal(saved.value.destination,`/resumen-salida/${token}/informe?borrador=1`);assert.equal(saved.effects.length,2);
 const [savedDraft]=await sql`select updated_at,status,participants from outing_reports where outing_id=${outing}`;assert.equal(savedDraft.status,'borrador');assert.ok(savedDraft.participants.every(p=>!p.attended));
 assert.equal((await sql`select count(*)::int n from volunteer_attendance_evidence where outing_id=${outing}`)[0].n,0);
 await reportFailure(()=>reports.submitReport(token,{},draft)); // Version 'new' is now stale.
 const final=form({intent:'finalizar',version:savedDraft.updated_at.toISOString(),location:'Local ficticio',activity:activityOptions[0],labour:labourOptions[0],starts:'2035-01-10',ends:'2035-01-12',actions:'Trabajo ficticio',host:'Responsable ficticio',accuracy:'on',attended:entry.id,roster:entry.id});
 const changedRoster=form(Object.fromEntries(final));changedRoster.delete('roster');await reportFailure(()=>reports.submitReport(token,{},changedRoster));
 await sql.unsafe(`create function asvo_report_contract_failure() returns trigger language plpgsql as $$begin
   if NEW.actions='__REPORT_CONTRACT_SQL_FAILURE__' then raise exception 'Synthetic report persistence failure'; end if;
   return NEW; end$$; create trigger asvo_report_contract_failure before insert or update on outing_reports for each row execute function asvo_report_contract_failure()`);
 const persistenceFailure=form(Object.fromEntries(final));persistenceFailure.set('actions','__REPORT_CONTRACT_SQL_FAILURE__');
 await reportFailure(()=>reports.submitReport(token,{},persistenceFailure));
 await sql.unsafe('drop trigger asvo_report_contract_failure on outing_reports; drop function asvo_report_contract_failure()');
 const finalSaved=await invoke(null,()=>reports.submitReport(token,{},final));assert.equal(finalSaved.value.saved,true);
 assert.equal(finalSaved.value.destination,`/resumen-salida/${token}/informe?enviado=1`);assert.equal(finalSaved.effects.length,2);
 const locked=await reportFailure(()=>reports.submitReport(token,{},final));assert.match(locked.error,/finalizado/);
 await reportFailure(()=>oldReport.submitReport(token,{},final)); // Adapter remains a verified consumer.
 assert.equal((await sql`select count(*)::int n from outing_reports where outing_id=${outing}`)[0].n,1);
 assert.equal((await sql`select count(*)::int n from audit where target=${outing} and action in ('Guardó borrador de informe','Finalizó informe de salida')`)[0].n,2);
 assert.equal((await sql`select count(*)::int n from volunteer_attendance_evidence where outing_id=${outing}`)[0].n,1);
 await invoke('general',()=>communications.revokeBrief(outing));assert.equal(await briefAccess(token),undefined);
 await reportFailure(()=>reports.submitReport(token,{},final));
 const reportAfter=await reportSnapshot();assert.equal(reportAfter.mail,reportBaseline.mail);assert.equal(reportAfter.demo,reportBaseline.demo,'Report retries/finalization do not enqueue mail');
 // Reminders use the existing queue after commit, with no real transport in demo.
 const past=randomUUID();await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status)values(${past},${request},'DEMO pasada','Local','Voluntariado General','2020-01-01','2020-01-02',false,2,'abierta')`;
 const pastEntry=randomUUID();await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${pastEntry},${past},${person},'892340567','2020-01-01','2020-01-02','confirmada','{"assigned70":true}'::jsonb)`;
 const beforeReminder=(await sql`select count(*)::int as n from demo_mail`)[0].n;assert.equal((await invoke('general',()=>communications.sendReportReminder(past,pastEntry,form({email:'person@example.test'})))).value.saved,true);assert.equal((await sql`select count(*)::int as n from demo_mail`)[0].n,beforeReminder+1);
 const login=await invoke(null,()=>session.login(form({role:'general'})));assert.equal(login.redirect,'/coordinacion');assert.equal(login.cookies[0].options.httpOnly,true);assert.equal((await invoke('general',()=>session.logout())).redirect,'/');
 assert.equal(networkCalls,0);assert.equal((await sql`select count(*)::int as n from registration_mail_outbox`)[0].n,0);
 console.log('OK: acciones canónicas/adaptadores, permisos, errores y efectos tras commit; creación/series/fotos, alta/edición/confirmación/70, invitaciones y enlaces, borrador/finalización/revocación, recordatorio demo y sesión. Sin red ni datos reales.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
