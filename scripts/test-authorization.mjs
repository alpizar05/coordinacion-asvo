import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';
requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){
 if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);
 if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const path=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(path)))return next(path.href,c);}
 return next(s,c);
},load(url,context,next){
 if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'transform',sourceUrl:url}),shortCircuit:true};
 return next(url,context);
}});
const {sql,demoCoordinator,demoAdmin}=await import('../lib/db.ts');
const {staff}=await import('../lib/auth.ts');
const actions=await import('../app/staff-actions.ts');
const {loadRegistrationDetail}=await import('../app/coordinacion/registration-detail-actions.ts');
const {addRegistration}=await import('../app/coordinacion/add-registration-actions.ts');
const {reconcileAttendance}=await import('../app/coordinacion/attendance-actions.ts');
const {generateBrief,revokeBrief}=await import('../app/coordinacion/salidas/[id]/resumen/actions.ts');
const {attachOutingPhoto}=await import('../app/photo-actions.ts');
const {GET:photo}=await import('../app/api/fotos/[id]/route.ts');
const {briefAccess}=await import('../lib/outing-brief.ts');
const {activeOutingInvitation}=await import('../lib/outing-invitations.ts');
const {saveOutingReport}=await import('../lib/outing-report.ts');
const {changePrivateRegistration}=await import('../lib/public-registration.ts');
const {digest}=await import('../lib/registration.ts');
const {createRegistrationReceipt,receiptCookie}=await import('../lib/registration-receipt.ts');
const {outingSeriesVersion}=await import('../lib/outing-editor.ts');
const {outingPhotoGallery}=await import('../lib/outing-photo-gallery.ts');
const form=(values={})=>{const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;};
const request=(role,callback,cookies={})=>requestContext.run({cookies:{...(role?{'asvo-demo':role}:{}),...cookies}},callback);
async function denied(callback){try{const result=await callback();assert.ok(result?.error,'An unauthorized direct call must return an error');assert.equal(result.saved,undefined);assert.equal(result.data,undefined);}catch(error){if(error instanceof assert.AssertionError)throw error;assert.match(error.message,/Acceso denegado/);}}
const token=()=>randomBytes(32).toString('base64url');
const ids={request:randomUUID(),brif:randomUUID(),uea:randomUUID(),person:randomUUID(),entry:randomUUID(),photo:randomUUID()};
try{
 await sql`delete from grants where subject in (${demoCoordinator},${demoAdmin})`;
 await sql`insert into grants(subject,role,unit)values(${demoCoordinator},'unidad','BRIF'),(${demoAdmin},'admin','')`;
 await sql`insert into requests(id,organization,activity)values(${ids.request},'DEMO autorización','Ficticia')`;
 for(const[id,unit]of[[ids.brif,'BRIF'],[ids.uea,'UEA']])await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed,registration_deadline)values(${id},${ids.request},'DEMO autorización','Ficticio',${unit},'2035-01-10','2035-01-12',false,3,'abierta',false,'2000-01-01')`;
 await sql`insert into volunteers(id,identification,name,surname,email)values(${ids.person},'102340567','Persona','Ficticia','persona@example.test')`;
 await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${ids.entry},${ids.uea},${ids.person},'102340567','2035-01-10','2035-01-12','confirmada','{"assigned70":true}'::jsonb)`;
 await sql`insert into outing_photos(id,outing_id,position,alt,credit,thumbnail,display_image)values(${ids.photo},${ids.uea},1,'Ficticia','',${Buffer.from('fake')},${Buffer.from('fake')})`;
 const sensitive=[()=>actions.editProfile(ids.person,form({name:'Cambio',surname:'Ficticio'})),()=>actions.verifyPolicy(form({volunteer:ids.person})),()=>actions.grant(form()),()=>actions.importPreview(''),()=>actions.applyImportRows(form()),()=>actions.previewPolicies(''),()=>actions.applyPolicyRows(form())];
 for(const role of [null,'general'])for(const call of sensitive)await request(role,()=>denied(call));
 for(const role of [null,'general','admin']){
  await request(role,()=>denied(()=>loadRegistrationDetail(ids.entry)));
  await request(role,()=>denied(()=>addRegistration(ids.uea,form())));
  await request(role,()=>denied(()=>reconcileAttendance(ids.uea,ids.person,form())));
  await request(role,()=>denied(()=>generateBrief(ids.uea,{},form({lead:ids.entry}))));
  await request(role,()=>denied(()=>revokeBrief(ids.uea)));
  await request(role,()=>denied(()=>attachOutingPhoto(ids.uea,form({action:'editar',photoId:ids.photo,alt:'Texto ficticio'}))));
  assert.equal((await request(role,()=>photo(new Request('http://localhost/api/fotos/'+ids.photo),{params:Promise.resolve({id:ids.photo})}))).status,404);
 }
 const common=form({apply:'title',confirm:'on',title:'Ficticia',version:await outingSeriesVersion(sql,ids.request)});await request('general',()=>denied(()=>actions.saveAutomaticCollection(ids.request,common)));
 await request('general',()=>denied(()=>attachOutingPhoto(ids.brif,form({action:'galeria',photoId:ids.photo,alt:'Ficticia'}))));
 await request('general',()=>denied(()=>actions.updateVolunteerUnits(ids.person,form())));
 await request('admin',()=>denied(()=>actions.recordVolunteerIncident(ids.person,form())));
 // A second request for another user cannot inherit the unit coordinator's grants.
 const [unitUser,adminUser,anonymous]=await Promise.all([request('general',()=>staff()),request('admin',()=>staff()),request(null,()=>staff())]);
 assert.equal(unitUser.subject,demoCoordinator);assert.equal(adminUser.subject,demoAdmin);assert.equal(anonymous,null);
 const fromUnit=await request('general',async()=>outingPhotoGallery(await staff()));assert.equal(fromUnit.length,0);
 await sql`update grants set unit='UEA' where subject=${demoCoordinator}`;
 assert.ok((await request('general',()=>loadRegistrationDetail(ids.entry))).data);
 assert.equal((await request('general',()=>photo(new Request('http://localhost/api/fotos/'+ids.photo),{params:Promise.resolve({id:ids.photo})}))).status,200);
 assert.equal((await request('admin',()=>actions.editProfile(ids.person,form({name:'Persona',surname:'Ficticia'})))).saved,true);
 assert.equal((await request('admin',()=>actions.updateVolunteerUnits(ids.person,form()))).saved,true);
 assert.ok((await sql`select units from volunteers where id=${ids.person}`)[0].units.includes('Voluntariado General'));
 // Capability binding, revocation, expiry, state and assignment checks run in PostgreSQL.
 const brief=token(),invite=token(),manage=token();
 await sql`insert into outing_brief_links(digest,outing_id,lead_registration_id,created_by)values(${digest(brief)},${ids.uea},${ids.entry},'test')`;
 await sql`insert into outing_invitations(digest,outing_id,volunteer_id,expires_at)values(${digest(invite)},${ids.uea},${ids.person},now()+interval '1 day')`;
 await sql`insert into links(digest,registration_id,purpose,expires)values(${digest(manage)},${ids.entry},'gestionar',now()+interval '1 day')`;
 await sql`update outing_brief_links set outing_id=${ids.brif} where digest=${digest(brief)}`;assert.equal(await briefAccess(brief),undefined);
 await sql`update outing_brief_links set outing_id=${ids.uea} where digest=${digest(brief)}`;
 assert.ok(await briefAccess(brief));assert.ok(await activeOutingInvitation(ids.uea,invite));assert.equal(await activeOutingInvitation(ids.brif,invite),undefined);
 const invitedUrl='http://localhost/api/fotos/'+ids.photo+'?invitacion='+invite;
 assert.equal((await request(null,()=>photo(new Request(invitedUrl),{params:Promise.resolve({id:ids.photo})}))).status,200);
 const receipt=await sql.begin(tx=>createRegistrationReceipt(tx,ids.entry,'confirmada'));
 assert.equal((await request(null,()=>photo(new Request('http://localhost/api/fotos/'+ids.photo),{params:Promise.resolve({id:ids.photo})}),{[receiptCookie(ids.uea)]:receipt})).status,200);
 const wrongEntry=randomUUID();await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${wrongEntry},${ids.brif},${ids.person},'102340567','2035-01-10','2035-01-12','revisión','{}'::jsonb)`;
 const wrongReceipt=await sql.begin(tx=>createRegistrationReceipt(tx,wrongEntry,'revisión'));
 assert.equal((await request(null,()=>photo(new Request('http://localhost/api/fotos/'+ids.photo),{params:Promise.resolve({id:ids.photo})}),{[receiptCookie(ids.uea)]:wrongReceipt})).status,404);
 await sql`update registration_receipts set expires_at=now()-interval '1 second' where digest=${digest(receipt)}`;
 assert.equal((await request(null,()=>photo(new Request('http://localhost/api/fotos/'+ids.photo),{params:Promise.resolve({id:ids.photo})}),{[receiptCookie(ids.uea)]:receipt})).status,404);
 await sql`update outing_invitations set used_at=now() where digest=${digest(invite)}`;assert.equal(await activeOutingInvitation(ids.uea,invite),undefined);
 await sql`update outing_invitations set used_at=null,expires_at=now()-interval '1 second' where digest=${digest(invite)}`;assert.equal(await activeOutingInvitation(ids.uea,invite),undefined);
 await sql`update outing_brief_links set revoked_at=now() where digest=${digest(brief)}`;assert.equal(await briefAccess(brief),undefined);
 const rejectedReport=await sql.begin(tx=>saveOutingReport(tx,brief,{},[],false,[],'borrador'));assert.ok(rejectedReport.error);
 await sql`update outing_brief_links set revoked_at=null,expires_at=now()-interval '1 second' where digest=${digest(brief)}`;assert.equal(await briefAccess(brief),undefined);
 await sql`update outing_brief_links set expires_at=now()+interval '1 day' where digest=${digest(brief)}`;
 await sql`update registrations set details='{}'::jsonb where id=${ids.entry}`;assert.equal(await briefAccess(brief),undefined);
 await sql`update links set expires=now()-interval '1 second' where digest=${digest(manage)}`;assert.ok((await sql.begin(tx=>changePrivateRegistration(tx,manage,form({action:'cancelar',reason:'Ficticio'})))).error);
 assert.equal((await request(null,()=>photo(new Request(invitedUrl),{params:Promise.resolve({id:ids.photo})}))).status,404);
 // Private-by-link remains available while open, even though it is unlisted.
 await sql`update outings set registration_deadline='2035-01-10' where id=${ids.uea}`;
 assert.equal((await request(null,()=>photo(new Request('http://localhost/api/fotos/'+ids.photo),{params:Promise.resolve({id:ids.photo})}))).status,200);
 assert.equal((await sql`select count(*)::int as n from registration_mail_outbox`)[0].n,0);
 console.log('OK: acciones y Route Handler reales, sin sesión/otra unidad/admin sin coordinación; acceso permitido, perfiles, unidades obligatorias, fotos, enlaces vencidos/revocados/usados y aislamiento entre peticiones.');
}finally{await sql.end();}
