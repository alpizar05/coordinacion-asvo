import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const url=new URL(process.env.DATABASE_URL);
if(process.env.ASVO_DEMO!=='1'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Solo demo local');
process.env.NODE_ENV='development';
registerHooks({resolve(s,c,n){if(s==='next/headers')return n(s+'.js',c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const p=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(p)))return n(p.href,c);}return n(s,c);}});
const {sql}=await import('../lib/db.ts');
const {manageStaffEntry}=await import('../lib/staff-entry-management.ts');
const {splitStaffGroup}=await import('../lib/staff-group.ts');
const {validateStaffParticipation,validateEntryManagement,validateSplitGroup}=await import('../lib/staff-registration-validation.ts');
const form=(values={})=>{const f=new FormData();for(const[k,v]of Object.entries(values))for(const item of Array.isArray(v)?v:[v])f.append(k,item);return f;};
assert.deepEqual(Object.keys(validateStaffParticipation(form({starts:'',ends:'',transport:'on',rides:'-1'}),{flexible:true,starts:'2035-01-10',ends:'2035-01-15'},true)).sort(),['ends','rides','starts','volunteer']);
assert.ok(validateEntryManagement(form(),'confirmar','2035-01-09/2035-01-12').approveDates);
assert.ok(validateEntryManagement(form(),'validar').identification);
assert.ok(validateEntryManagement(form(),'cancelar').reason);
assert.deepEqual(Object.keys(validateSplitGroup(form({title:'',capacity:'0'}))),['title','capacity']);
const fetchOriginal=globalThis.fetch;globalThis.fetch=()=>{throw Error('Red real prohibida');};

async function concurrentDecisions(){
 const request=randomUUID(),outing=randomUUID(),person=randomUUID(),id=randomUUID();
 try{
  await sql.begin(async tx=>{
   await tx`insert into requests(id,organization,activity)values(${request},'DEMO concurrencia errores','Prueba')`;
   await tx`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${outing},${request},'DEMO concurrencia errores','Local','Voluntariado General','2035-01-10','2035-01-15',true,1,'abierta',false)`;
   await tx`insert into volunteers(id,identification,name,surname,email)values(${person},${person},'Persona','Ficticia',${person+'@example.test'})`;
   const [policy]=await tx`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)values(${person},'DEMO','DEMO','2035-01-01','2035-01-31',now())returning id`;
   await tx`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details,policy_id)values(${id},${outing},${person},${person},'2035-01-10','2035-01-12','revisión','{}'::jsonb,${policy.id})`;
  });
  const [{version}]=await sql`select md5(to_jsonb(r)::text)as version from registrations r where id=${id}`;
  const decide=()=>sql.begin(tx=>manageStaffEntry(tx,id,form({version,schedule:'2035-01-10/2035-01-15/true',action:'confirmar'}),{actor:'prueba-local',canOperate:()=>true}));
  const results=await Promise.all([decide(),decide()]);
  assert.equal(results.filter(r=>r.saved).length,1);
  assert.equal(results.filter(r=>r.error?.includes('cambió')).length,1);
  assert.equal((await sql`select count(*)::int as n from audit where target=${id} and action='Confirmó cupo'`)[0].n,1);
  assert.equal((await sql`select count(*)::int as n from demo_mail where registration_id=${id}`)[0].n,1);
  console.log('OK: dos decisiones simultáneas con la misma versión producen un guardado y un conflicto; una auditoría y una notificación demo.');
 }finally{
  await sql.begin(async tx=>{
   await tx`delete from demo_mail where registration_id=${id}`;
   await tx`delete from links where registration_id=${id}`;
   await tx`delete from registration_mail_outbox where registration_id=${id}`;
   await tx`delete from audit where target=${id}`;
   await tx`delete from registrations where id=${id}`;
   await tx`delete from policies where volunteer_id=${person}`;
   await tx`delete from volunteers where id=${person}`;
   await tx`delete from outings where id=${outing}`;
   await tx`delete from requests where id=${request}`;
  });
 }
}
const rollback=Error('rollback');
try{await sql.begin(async tx=>{
 const request=randomUUID(),outing=randomUUID(),person=randomUUID();
 await tx`insert into requests(id,organization,activity)values(${request},'DEMO errores coordinación','Prueba')`;
 await tx`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${outing},${request},'DEMO errores coordinación','Local','Voluntariado General','2035-01-10','2035-01-15',true,2,'abierta',false)`;
 await tx`insert into volunteers(id,identification,name,surname,email)values(${person},${person.replaceAll('-','').slice(0,20).toUpperCase()},'Persona','Ficticia',${person+'@example.test'})`;
 await tx`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)values(${person},'DEMO','DEMO','2035-01-01','2035-01-31',now())`;
 const [entry]=await tx`insert into registrations(outing_id,volunteer_id,identification,starts,ends,status,details)values(${outing},${person},${person.replaceAll('-','').slice(0,20).toUpperCase()},'2035-01-09','2035-01-12','revisión','{}'::jsonb)returning id`;
 const context={actor:'prueba-local',canOperate:()=>true};
 const stamp='2035-01-10/2035-01-15/true';
 const version=async()=>String((await tx`select md5(to_jsonb(r)::text)as version from registrations r where id=${entry.id}`)[0].version);
 const manage=async(action,values={})=>manageStaffEntry(tx,entry.id,form({version:await version(),schedule:stamp,action,...values}),context);
 assert.ok((await manage('confirmar')).fieldErrors.approveDates);
 assert.ok((await manage('espera')).fieldErrors.reason);
 assert.equal((await manageStaffEntry(tx,entry.id,form({version:await version(),schedule:stamp,action:'confirmar'}),{...context,canOperate:()=>false})).fieldErrors,undefined);
 const old=await version();
 assert.equal((await manage('confirmar',{approveDates:'2035-01-09/2035-01-12'})).saved,true);
 const count=async()=>Number((await tx`select count(*)::int as n from demo_mail where registration_id=${entry.id}`)[0].n);
 const mails=await count();
 assert.ok((await manageStaffEntry(tx,entry.id,form({version:old,schedule:stamp,action:'confirmar',approveDates:'2035-01-09/2035-01-12'}),context)).error.includes('cambió'));
 assert.equal(await count(),mails,'Reintento obsoleto no notifica');
 assert.equal((await manage('espera',{reason:'Motivo ficticio'})).saved,true);
 assert.equal((await manage('rechazar',{reason:'Motivo ficticio'})).saved,true);
 assert.ok((await manage('confirmar',{approveDates:'2035-01-09/2035-01-12'})).error);
 await tx`update registrations set status='revisión' where id=${entry.id}`;
 assert.equal((await manage('cancelar',{reason:'Motivo ficticio'})).saved,true);
 await tx`update registrations set status='validación',volunteer_id=null where id=${entry.id}`;
 assert.ok((await manage('validar',{identification:'?'})).fieldErrors.identification);
 assert.ok((await manage('validar',{identification:'NOEXISTE'})).fieldErrors.identification);
 assert.equal((await manage('validar',{identification:person.replaceAll('-','').slice(0,20).toUpperCase()})).saved,true);
 assert.equal((await tx`select status from registrations where id=${entry.id}`)[0].status,'revisión','Recuperación reserva cupo disponible');
 const groupForm=values=>form({member:[entry.id],...values});
 const invalid=await splitStaffGroup(tx,outing,'2035-01-09','2035-01-12',groupForm({title:'',capacity:'0'}),context);
 assert.ok(invalid.fieldErrors.title);assert.ok(invalid.fieldErrors.capacity);
 const moved=await splitStaffGroup(tx,outing,'2035-01-09','2035-01-12',groupForm({title:'Grupo ficticio',capacity:'1'}),context);
 assert.equal(moved.saved,true);
 assert.equal((await tx`select outing_id from registrations where id=${entry.id}`)[0].outing_id,moved.id);
 assert.ok((await splitStaffGroup(tx,outing,'2035-01-09','2035-01-12',groupForm({title:'Grupo ficticio',capacity:'1'}),context)).error.includes('cambió'));
 assert.equal((await tx`select count(*)::int as n from registration_mail_outbox where registration_id=${entry.id}`)[0].n,0);
 throw rollback;
});}catch(e){if(e!==rollback)throw e;console.log('OK: errores múltiples, permisos, aprobación, decisiones, recuperación, versiones obsoletas, agrupación modificada y guardados; rollback local sin correo real.');await concurrentDecisions();}
finally{globalThis.fetch=fetchOriginal;await sql.end();}
