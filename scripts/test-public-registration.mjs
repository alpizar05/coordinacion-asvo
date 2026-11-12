import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID,randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const url=new URL(process.env.DATABASE_URL);
if(process.env.ASVO_DEMO!=='1'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Solo base demo local');
process.env.NODE_ENV='development';
registerHooks({resolve(specifier,context,next){
 if(specifier==='next/headers')return next(specifier+'.js',context);
 if(specifier.startsWith('.')&&context.parentURL&&!/\.[a-z]+$/.test(specifier)){const path=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(path)))return next(path.href,context);}
 return next(specifier,context);
}});
const {sql}=await import('../lib/db.ts');
const {receivePublicRegistration,changePrivateRegistration}=await import('../lib/public-registration.ts');
const {validateParticipation,validateCancellation}=await import('../lib/registration-validation.ts');
const {digest}=await import('../lib/registration.ts');
const form=(fields={})=>{const data=new FormData();for(const[k,v]of Object.entries({identification:'987654321',starts:'2035-01-10',ends:'2035-01-12',...fields}))data.set(k,v);return data;};
const schedule={flexible:true,starts:'2035-01-10',ends:'2035-01-15'};
assert.deepEqual(Object.keys(validateParticipation(form({identification:'1-234',starts:'',ends:'',transport:'on',rides:'-1'}),schedule,true)),['identification','starts','ends','rides']);
assert.deepEqual(validateParticipation(form({starts:'2035-01-09',ends:'2035-01-16'}),schedule),{},'Permite extender participación flexible con intersección');
assert.ok(validateParticipation(form({ends:'2035-01-09'}),schedule).ends);
assert.ok(validateCancellation(form({reason:''}),true).reason);
assert.ok(validateCancellation(form({reason:''}),true).acknowledge);
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Red real prohibida en pruebas');};
const rollback=new Error('rollback');
try{await sql.begin(async tx=>{
 const request=randomUUID(),outing=randomUUID(),person=randomUUID(),other=randomUUID();
 await tx`insert into requests(id,organization,activity)values(${request},'DEMO errores públicos','Prueba')`;
 await tx`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${outing},${request},'DEMO errores públicos','Local','Voluntariado General','2035-01-10','2035-01-15',true,1,'abierta',true)`;
 for(const[id,identification]of [[person,'987654321'],[other,'987654322']]){
  await tx`insert into volunteers(id,identification,name,surname,email)values(${id},${identification},'Persona','Ficticia',${id+'@example.test'})`;
  await tx`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)values(${id},'DEMO','DEMO','2035-01-01','2035-01-31',now())`;
 }
 const stamp='2035-01-10/2035-01-15/true';let ip=0;
 const receive=data=>receivePublicRegistration(tx,outing,stamp,'',data,`demo-${request}-${++ip}`);
 assert.ok((await receive(form({identification:'123'}))).fieldErrors.identification);
 assert.ok((await receive(form({identification:'987654320'}))).issue.title.includes('Identificación'));
 await tx`update policies set verified_at=null where volunteer_id=${person}`;
 assert.ok((await receive(form())).issue.title.includes('póliza'));
 assert.equal((await tx`select count(*)::int as n from registrations where outing_id=${outing}`)[0].n,0);
 await tx`update policies set verified_at=now() where volunteer_id=${person}`;
 const received=await receive(form());assert.equal(received.status,'revisión');
 const firstMailCount=(await tx`select count(*)::int as n from demo_mail where registration_id=${received.id}`)[0].n;
 assert.ok((await receive(form())).error.includes('activa'));
 assert.equal((await tx`select count(*)::int as n from demo_mail where registration_id=${received.id}`)[0].n,firstMailCount);
 const waiter=await receive(form({identification:'987654322'}));assert.equal(waiter.status,'espera');
 const token=randomBytes(32).toString('base64url');
 await tx`insert into links(digest,registration_id,purpose,expires)values(${digest(token)},${received.id},'gestionar',now()+interval '1 day')`;
 const bad=await changePrivateRegistration(tx,token,form({action:'editar',ends:'2035-01-09',transport:'on',rides:'-2'}));assert.ok(bad.fieldErrors.ends);assert.ok(bad.fieldErrors.rides);
 await tx`update policies set verified_at=null where volunteer_id=${person}`;
 assert.ok((await changePrivateRegistration(tx,token,form({action:'editar'}))).issue.title.includes('póliza'));
 await tx`update policies set verified_at=now() where volunteer_id=${person}`;
 await tx`update outings set unit='BRIF' where id=${outing}`;
 assert.ok((await changePrivateRegistration(tx,token,form({action:'editar'}))).error.includes('unidad'));
 await tx`update outings set unit='Voluntariado General' where id=${outing}`;
 const editedForm=form({action:'editar',starts:'2035-01-11',food:'Dato ficticio'});
 await tx`update registrations set status='confirmada' where id=${received.id}`;
 assert.equal((await changePrivateRegistration(tx,token,editedForm)).saved,true);
 assert.equal((await tx`select status from registrations where id=${received.id}`)[0].status,'revisión');
 const afterEdit=(await tx`select count(*)::int as n from demo_mail where registration_id=${received.id}`)[0].n;
 assert.equal((await changePrivateRegistration(tx,token,editedForm)).saved,true);
 assert.equal((await tx`select count(*)::int as n from demo_mail where registration_id=${received.id}`)[0].n,afterEdit,'Reintento idéntico no notifica');
 assert.ok((await changePrivateRegistration(tx,token,form({action:'cancelar',reason:''}))).fieldErrors.reason);
 await tx`update registrations set starts=current_date-1 where id=${received.id}`;
 assert.ok((await changePrivateRegistration(tx,token,form({action:'cancelar',reason:'Motivo ficticio'}))).fieldErrors.acknowledge,'La aceptación se valida también en servidor');
 const cancellation=form({action:'cancelar',reason:'Motivo ficticio',acknowledge:'on'});
 assert.equal((await changePrivateRegistration(tx,token,cancellation)).saved,true);
 assert.equal((await tx`select status from registrations where id=${waiter.id}`)[0].status,'revisión','Promueve la primera persona en espera');
 const afterCancel=(await tx`select count(*)::int as n from demo_mail where registration_id=${received.id}`)[0].n;
 assert.equal((await changePrivateRegistration(tx,token,cancellation)).saved,true);
 assert.equal((await tx`select count(*)::int as n from demo_mail where registration_id=${received.id}`)[0].n,afterCancel,'Cancelación repetida no vuelve a notificar');
 assert.equal((await tx`select count(*)::int as n from registrations where outing_id=${outing}`)[0].n,2);
 assert.equal((await tx`select count(*)::int as n from registration_mail_outbox where registration_id in (${received.id},${waiter.id})`)[0].n,0,'No hay correo real');
 throw rollback;
});}catch(error){if(error!==rollback)throw error;console.log('OK: errores múltiples, identificación/póliza distintas, cupos, espera, edición, cancelación, promoción y reintentos sin duplicados; rollback local, cero red real.');}
finally{globalThis.fetch=originalFetch;await sql.end();}
