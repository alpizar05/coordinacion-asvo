import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks} from 'node:module';import {existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {randomUUID,randomBytes} from 'node:crypto';import assert from 'node:assert/strict';
// Exercise the durable outbox, not a provider. The URL was protected above; no production env file is loaded.
process.env.NODE_ENV='production';
process.env.ASVO_DEMO='0';
process.env.AUTH_SECRET='fictitious-local-test-key-with-32-characters';
registerHooks({resolve(s,c,next){if(s==='next/headers')return next(s+'.js',c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {sql}=await import('../lib/db.ts');
const {receiveRegistration,changeRegistrationStatus,occupiedSeats,assignRegistration70,promoteWaitlist}=await import('../lib/registration-workflow.ts');
const {manageStaffEntry}=await import('../lib/staff-entry-management.ts');
const {saveOutingDecision}=await import('../lib/outing-decision.ts');
const {outingEditVersion}=await import('../lib/outing-editor.ts');
const {saveOutingReport}=await import('../lib/outing-report.ts');
const {activityOptions}=await import('../lib/outing-report-options.ts');
const {changePrivateRegistration}=await import('../lib/public-registration.ts');
const {digest}=await import('../lib/registration.ts');
const originalFetch=globalThis.fetch;let network=0;globalThis.fetch=async()=>{network++;throw Error('Red externa prohibida');};
const form=(values={})=>{const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;};
const actor={actor:'coordinador-ficticio',canOperate:()=>true};
async function outing(status='abierta',capacity=1){
 const request=randomUUID(),id=randomUUID();await sql`insert into requests(id,organization,activity)values(${request},'DEMO transiciones','Prueba ficticia')`;
 await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${id},${request},'DEMO transiciones','Ficticio','Voluntariado General','2000-01-01','2000-01-02',true,${capacity},${status},false)`;return id;
}
async function person(){const id=randomUUID(),identification='T'+id.replaceAll('-','').slice(0,20).toUpperCase();
 await sql`insert into volunteers(id,identification,name,surname,email)values(${id},${identification},'Persona','Ficticia',${id+'@example.test'})`;
 await sql`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)values(${id},'DEMO',${id},'1990-01-01','2040-01-01',now())`;return {id,identification};}
const locked=(id,callback)=>sql.begin(async tx=>{await tx`select id from outings where id=${id} for update`;return callback(tx);});
const receive=(id,p)=>locked(id,tx=>receiveRegistration(tx,{outingId:id,volunteerId:p.id,identification:p.identification,starts:'2000-01-01',ends:'2000-01-02',details:{}}));
const version=async id=>(await sql`select md5(to_jsonb(r)::text)as version from registrations r where id=${id}`)[0].version;
const manage=(id,values)=>sql.begin(tx=>manageStaffEntry(tx,id,form({schedule:'2000-01-01/2000-01-02/true',...values}),actor));
const snapshot=async()=>({registrations:await sql`select id,status,details,policy_id from registrations order by id`,outings:await sql`select id,status from outings order by id`,
 audit:await sql`select * from audit order by id`,mail:await sql`select * from registration_mail_outbox order by id`,links:await sql`select * from links order by digest`});
const decision=async(id,action,values={})=>sql.begin(async tx=>saveOutingDecision(tx,id,form({action,version:await outingEditVersion(tx,id),...values}),actor));
try{
 const id=await outing(),people=await Promise.all([person(),person(),person()]);
 const first=await receive(id,people[0]),second=await receive(id,people[1]),third=await receive(id,people[2]);
 assert.equal(first.status,'revisión');assert.equal(second.status,'espera');assert.equal(third.status,'espera');
 assert.ok((await manage(first.id,{action:'cancelar',version:await version(first.id)})).fieldErrors.reason);
 const v=await version(first.id),cancel={action:'cancelar',version:v,reason:'Motivo ficticio'};
 const concurrent=await Promise.all([manage(first.id,cancel),manage(first.id,cancel)]);
 assert.equal(concurrent.filter(r=>r.saved).length,1);assert.equal(concurrent.filter(r=>r.error?.includes('cambió')).length,1);
 assert.equal((await sql`select count(*)::int as n from audit where target=${second.id} and action='Asignó cupo desde lista de espera'`)[0].n,1);
 assert.equal((await sql`select status from registrations where id=${second.id}`)[0].status,'revisión');
 assert.equal((await sql`select status from registrations where id=${third.id}`)[0].status,'espera');
 const after=await snapshot();await locked(id,tx=>promoteWaitlist(tx,id,'sistema'));assert.deepEqual(await snapshot(),after);
 assert.equal((await receive(id,people[2])).duplicate,true);assert.deepEqual(await snapshot(),after);
 const reopening=await manage(first.id,{action:'confirmar',version:await version(first.id)});assert.match(reopening.error,/cupos/);
 await sql`update outings set capacity=2 where id=${id}`;
 // Recovery must give the newly available seat to the older waiting person before trying to reopen.
 assert.match((await manage(first.id,{action:'confirmar',version:await version(first.id)})).error,/cupos/);
 assert.equal((await sql`select status from registrations where id=${third.id}`)[0].status,'revisión');
 await sql`update outings set capacity=3 where id=${id}`;
 assert.equal((await manage(first.id,{action:'confirmar',version:await version(first.id)})).saved,true);
 assert.equal((await sql`select count(*)::int as n from registrations where outing_id=${id}`)[0].n,3);
 assert.equal((await sql`select count(*)::int as n from audit where target=${first.id} and action='Reactivó y confirmó inscripción cancelada'`)[0].n,1);
 // Private self-cancellation is idempotent and can later be recovered by Coordination.
 const token=randomBytes(32).toString('base64url');await sql`insert into links(digest,registration_id,purpose,expires)values(${digest(token)},${first.id},'gestionar',now()+interval '1 day')`;
 const privateCancel=form({action:'cancelar',reason:'Motivo ficticio',acknowledge:'on'});
 assert.equal((await sql.begin(tx=>changePrivateRegistration(tx,token,privateCancel))).saved,true);const self=await snapshot();
 assert.equal((await sql.begin(tx=>changePrivateRegistration(tx,token,privateCancel))).saved,true);assert.deepEqual(await snapshot(),self);
 assert.equal((await manage(first.id,{action:'confirmar',version:await version(first.id)})).saved,true);
 // Real outbox writes fail during promotion: state, cancellation mail, links and audits all roll back.
 const atomic=await outing(),a=await receive(atomic,await person()),b=await receive(atomic,await person());
 await sql.unsafe(`create function asvo_test_fail_mail()returns trigger language plpgsql as $$begin if NEW.registration_id::text=current_setting('asvo.fail_mail_registration',true) then raise exception 'synthetic mail failure';end if;return NEW;end$$`);
 await sql.unsafe('create trigger asvo_test_fail_mail before insert on registration_mail_outbox for each row execute function asvo_test_fail_mail()');
 const before=await snapshot();
 await assert.rejects(()=>locked(atomic,async tx=>{await tx`select set_config('asvo.fail_mail_registration',${b.id},true)`;return changeRegistrationStatus(tx,a.id,'ficticio','cancelar','Motivo','');}),/synthetic mail failure/);
 assert.deepEqual(await snapshot(),before,'Cancellation, promotion, audits, links and outbox are one transaction');
 assert.equal(await locked(atomic,tx=>changeRegistrationStatus(tx,a.id,'ficticio','cancelar','Motivo','')),undefined);
 assert.equal((await sql`select count(*)::int as n from audit where target=${b.id} and action='Asignó cupo desde lista de espera'`)[0].n,1);
 // Failure during bulk outing cancellation also rolls back previously queued messages.
 const bulkBefore=await snapshot();
 await assert.rejects(()=>sql.begin(async tx=>{await tx`select set_config('asvo.fail_mail_registration',${b.id},true)`;return saveOutingDecision(tx,atomic,form({action:'cancelar-salida',reason:'Ficticio',version:await outingEditVersion(tx,atomic)}),actor);}),/synthetic mail failure/);
 assert.deepEqual(await snapshot(),bulkBefore);
 const bulkVersion=await outingEditVersion(sql,atomic);
 const bulkCancels=await Promise.all([sql.begin(tx=>saveOutingDecision(tx,atomic,form({action:'cancelar-salida',reason:'Ficticio',version:bulkVersion}),actor)),sql.begin(tx=>saveOutingDecision(tx,atomic,form({action:'cancelar-salida',reason:'Ficticio',version:bulkVersion}),actor))]);
 assert.equal(bulkCancels.filter(r=>r.saved).length,1);assert.equal(bulkCancels.filter(r=>r.error).length,1);
 assert.equal((await sql`select count(*)::int as n from audit where target=${atomic} and action='Canceló convocatoria'`)[0].n,1);
 assert.ok((await decision(atomic,'cancelar-salida',{reason:'Ficticio'})).error);
 // Draft/concurrent drafts/finalization. Draft participant selection must not become evidence.
 const reportOuting=await outing(),lead=await receive(reportOuting,await person());
 await locked(reportOuting,tx=>changeRegistrationStatus(tx,lead.id,'ficticio','confirmar','',''));
 await locked(reportOuting,tx=>assignRegistration70(tx,lead.id,'ficticio',true));
 const brief=randomBytes(32).toString('base64url');await sql`insert into outing_brief_links(digest,outing_id,lead_registration_id,created_by)values(${digest(brief)},${reportOuting},${lead.id},'ficticio')`;
 const draft={labour:[],location:'',activity:'',starts:'',ends:'',actions:'',host:'',observations:''};
 const draftResult=await sql.begin(tx=>saveOutingReport(tx,brief,draft,[lead.id],false,[],'borrador','new'));assert.equal(draftResult.status,'borrador');
 assert.equal((await sql`select count(*)::int as n from volunteer_attendance_evidence where outing_id=${reportOuting}`)[0].n,0);
 const reportVersion=async()=>new Date((await sql`select updated_at from outing_reports where id=${draftResult.id}`)[0].updated_at).toISOString();
 await sql`update outing_reports set updated_at=updated_at-interval '1 second' where id=${draftResult.id}`;
 const old=await reportVersion();
 const edits=await Promise.all([sql.begin(tx=>saveOutingReport(tx,brief,{...draft,observations:'A'},[],false,[],'borrador',old)),sql.begin(tx=>saveOutingReport(tx,brief,{...draft,observations:'B'},[],false,[],'borrador',old))]);
 assert.equal(edits.filter(r=>r.id).length,1);assert.equal(edits.filter(r=>r.error?.includes('cambió')).length,1);
 const completed={labour:['Mantenimiento y otros'],location:'Ficticio',activity:activityOptions[0],starts:'2000-01-01',ends:'2000-01-02',actions:'Acciones ficticias',host:'Responsable ficticio',observations:''};
 const current=await reportVersion();
 const finalized=await Promise.all([sql.begin(tx=>saveOutingReport(tx,brief,completed,[lead.id],true,[lead.id],'finalizar',current)),sql.begin(tx=>saveOutingReport(tx,brief,completed,[lead.id],true,[lead.id],'finalizar',current))]);
 assert.equal(finalized.filter(r=>r.id).length,1);assert.equal(finalized.filter(r=>r.error?.includes('finalizado')).length,1);
 assert.equal((await sql`select count(*)::int as n from audit where target=${reportOuting} and action='Finalizó informe de salida'`)[0].n,1);
 assert.equal((await sql`select count(*)::int as n from volunteer_attendance_evidence where outing_id=${reportOuting}`)[0].n,1);
 assert.equal((await sql`select status from outings where id=${reportOuting}`)[0].status,'abierta','A final report does not silently complete the outing');
 assert.ok((await sql.begin(tx=>saveOutingReport(tx,brief,draft,[],false,[],'borrador'))).error);
 const stale=form({action:'completar',confirmCompleted:'on',version:'obsoleta'});assert.ok((await sql.begin(tx=>saveOutingDecision(tx,reportOuting,stale,actor))).error.includes('cambió'));
 assert.equal((await decision(reportOuting,'completar',{confirmCompleted:'on'})).saved,true);
 // Audit failure rolls back a draft write, just like a notification failure rolls back a registration.
 await sql.unsafe(`create function asvo_test_fail_audit()returns trigger language plpgsql as $$begin if NEW.target=current_setting('asvo.fail_audit_target',true) then raise exception 'synthetic audit failure';end if;return NEW;end$$`);
 await sql.unsafe('create trigger asvo_test_fail_audit before insert on audit for each row execute function asvo_test_fail_audit()');
 const draftOuting=await outing(),draftLead=await receive(draftOuting,await person());await locked(draftOuting,tx=>changeRegistrationStatus(tx,draftLead.id,'ficticio','confirmar','',''));await locked(draftOuting,tx=>assignRegistration70(tx,draftLead.id,'ficticio',true));
 const draftToken=randomBytes(32).toString('base64url');await sql`insert into outing_brief_links(digest,outing_id,lead_registration_id,created_by)values(${digest(draftToken)},${draftOuting},${draftLead.id},'ficticio')`;
 await assert.rejects(()=>sql.begin(async tx=>{await tx`select set_config('asvo.fail_audit_target',${draftOuting},true)`;return saveOutingReport(tx,draftToken,draft,[],false,[],'borrador','new');}),/synthetic audit failure/);
 assert.equal((await sql`select count(*)::int as n from outing_reports where outing_id=${draftOuting}`)[0].n,0);
 const persistedDraft=await sql.begin(tx=>saveOutingReport(tx,draftToken,draft,[],false,[],'borrador','new'));
 const persistedVersion=new Date((await sql`select updated_at from outing_reports where id=${persistedDraft.id}`)[0].updated_at).toISOString();
 await assert.rejects(()=>sql.begin(async tx=>{await tx`select set_config('asvo.fail_audit_target',${draftOuting},true)`;return saveOutingReport(tx,draftToken,completed,[draftLead.id],true,[draftLead.id],'finalizar',persistedVersion);}),/synthetic audit failure/);
 assert.equal((await sql`select status from outing_reports where id=${persistedDraft.id}`)[0].status,'borrador');
 assert.equal((await sql`select count(*)::int as n from volunteer_attendance_evidence where outing_id=${draftOuting}`)[0].n,0);
 assert.equal((await sql.begin(tx=>saveOutingReport(tx,draftToken,completed,[draftLead.id],true,[draftLead.id],'finalizar',persistedVersion))).status,'finalizado');
 assert.equal((await sql`select count(*)::int as n from audit where target=${draftOuting} and action='Finalizó informe de salida'`)[0].n,1);

 // SQL predicates match the shared categories; cancellation leaves unrecognized historical states untouched.
 const categories=await outing('abierta',10),states=['validación','revisión','espera','confirmada','rechazada','cancelada por coordinación','cancelada por voluntariado','completada'];
 for(const state of states){const participant=await person();await sql`insert into registrations(outing_id,volunteer_id,identification,starts,ends,status,details)values(${categories},${participant.id},${participant.identification},'2000-01-01','2000-01-02',${state},'{}'::jsonb)`;}
 assert.equal(await locked(categories,tx=>occupiedSeats(tx,categories)),2);
 const beforeCategoryMail=(await sql`select count(*)::int as n from registration_mail_outbox`)[0].n;
 assert.equal((await decision(categories,'cancelar-salida',{reason:'Ficticio'})).saved,true);
 assert.equal((await sql`select count(*)::int as n from registrations where outing_id=${categories} and status='completada'`)[0].n,1);
 assert.equal((await sql`select count(*)::int as n from registration_mail_outbox`)[0].n-beforeCategoryMail,4);
 // Unknown historical states survive rejected operations; no migration or normalization is run.
 const historical=await outing('histórico desconocido'),historicalEntry=randomUUID(),p=await person();
 await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${historicalEntry},${historical},${p.id},${p.identification},'2000-01-01','2000-01-02','completada','{}'::jsonb)`;
 const historicalSnapshot=await snapshot();assert.ok(await locked(historical,tx=>changeRegistrationStatus(tx,historicalEntry,'ficticio','confirmar','','')));assert.ok((await decision(historical,'completar',{confirmCompleted:'on'})).error);assert.deepEqual(await snapshot(),historicalSnapshot);
 assert.equal(await locked(id,tx=>occupiedSeats(tx,id)),3);
 assert.ok((await sql`select recipient from registration_mail_outbox`).every(row=>row.recipient.endsWith('.test')));assert.equal(network,0);
 console.log('OK: transiciones, recuperación cancelada, promociones FIFO, decisiones/versiones simultáneas, outbox/auditoría atómicos ante fallos, informes borrador/finalizado y estados históricos intactos. Cero red/envíos reales.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
