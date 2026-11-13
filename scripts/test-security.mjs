import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const p=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(p)))return next(p.href,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'transform',sourceUrl:url}),shortCircuit:true};return next(url,c);}});

const {sql}=await import('../lib/db.ts');
const {digest}=await import('../lib/registration.ts');
const {registrationLinkCondition}=await import('../lib/authorization-sql.ts');
const {revokeRegistrationLinks,revokeOutingInvitations}=await import('../lib/private-links.ts');
const {activeOutingInvitation}=await import('../lib/outing-invitations.ts');
const {createRegistrationReceipt,readRegistrationReceipt,receiptCookie}=await import('../lib/registration-receipt.ts');
const {abuseBucket,consumeAbuseLimit,consumePrivateBudget}=await import('../lib/abuse-limits.ts');
const {assertDemoHost}=await import('../lib/server-config.mjs');
const {staff}=await import('../lib/auth.ts');
const {graphMail}=await import('../lib/graph-mail.mjs');
const {submitPrivateRegistration}=await import('../app/public-actions.ts');
const request=randomUUID(),outing=randomUUID(),person=randomUUID(),entry=randomUUID();
const general={subject:'fictitious',grants:[{role:'general',unit:''}]},other={subject:'other',grants:[{role:'unidad',unit:'BRIF'}]};
const token=()=>randomBytes(32).toString('base64url');let network=0;
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{network++;throw Error('External calls prohibited');};
try{
 await sql`insert into requests(id,organization,activity)values(${request},'Ficticia','Prueba')`;
 await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status)values(${outing},${request},'Ficticia','Local','Voluntariado General','2035-01-01','2035-01-02',false,3,'abierta')`;
 await sql`insert into volunteers(id,identification,name,surname,email)values(${person},'891234567','Ficticia','Prueba','fictitious@example.test')`;
 await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${entry},${outing},${person},'891234567','2035-01-01','2035-01-02','revisión','{}')`;
 const valid=token(),expired=token(),wrong=token(),historical=token();
 for(const [value,purpose,expiry]of [[valid,'gestionar','2036-01-01'],[expired,'gestionar','2000-01-01'],[wrong,'unknown','2036-01-01'],[historical,'gestion','2036-01-01']])await sql`insert into links(digest,registration_id,purpose,expires)values(${digest(value)},${entry},${purpose},${expiry})`;
 const read=async value=>(await sql`select registration_id from links where ${registrationLinkCondition(sql,value)}`).length;
 assert.equal(await read(valid),1);assert.equal(await read(expired),0);assert.equal(await read(wrong),0);assert.equal(await read(historical),1);
 const invite=token();await sql`insert into outing_invitations(digest,outing_id,volunteer_id,expires_at)values(${digest(invite)},${outing},${person},'2036-01-01')`;
 assert.ok(await activeOutingInvitation(outing,invite));assert.equal(await activeOutingInvitation(randomUUID(),invite),undefined);
 await sql`update outing_invitations set used_at=clock_timestamp() where digest=${digest(invite)}`;assert.equal(await activeOutingInvitation(outing,invite),undefined);
 await sql`update outing_invitations set used_at=null where digest=${digest(invite)}`;
 const receipt=await sql.begin(tx=>createRegistrationReceipt(tx,entry,'revisión'));
 const readReceipt=id=>requestContext.run({cookies:{[receiptCookie(id)]:receipt}},()=>readRegistrationReceipt(id));
 assert.ok(await readReceipt(outing));assert.equal(await readReceipt(randomUUID()),undefined);
 await sql`update registration_receipts set expires_at='2000-01-01' where digest=${digest(receipt)}`;assert.equal(await readReceipt(outing),undefined);
 await sql.begin(tx=>createRegistrationReceipt(tx,entry,'revisión'));
 assert.equal((await sql`select count(*)::int as n from registration_receipts where digest=${digest(receipt)}`)[0].n,1,'Expired receipts retained; no implicit retention policy');
 for(const actor of [null,other]){
  await assert.rejects(()=>sql.begin(tx=>revokeRegistrationLinks(tx,entry,actor)),/denegado/);
  await assert.rejects(()=>sql.begin(tx=>revokeOutingInvitations(tx,outing,actor)),/denegado/);
 }
 await sql.begin(tx=>revokeRegistrationLinks(tx,entry,general));await sql.begin(tx=>revokeOutingInvitations(tx,outing,general));
 assert.equal(await read(valid),0);assert.equal(await read(historical),0);assert.equal(await activeOutingInvitation(outing,invite),undefined);
 assert.equal((await sql`select count(*)::int as n from links`)[0].n,4,'Revokes without deleting historical data');
 assert.ok((await sql`select revoked_at from registration_receipts`).every(r=>r.revoked_at));
 assert.equal((await sql`select count(*)::int as n from audit where actor='fictitious'`)[0].n,2);
 // Atomic counters, independent identities behind one shared connection, no raw identifiers.
 const shared='192.0.2.10';for(let i=0;i<40;i++)await sql.begin(async tx=>{assert.equal(await consumeAbuseLimit(tx,'register:network',shared,300),true);assert.equal(await consumeAbuseLimit(tx,'register:id','fictitious-'+i,8),true);});
 const concurrent=await Promise.all(Array.from({length:12},()=>sql.begin(tx=>consumeAbuseLimit(tx,'concurrent','fictitious',2))));assert.equal(concurrent.filter(Boolean).length,2);
 const capability=token();for(let i=0;i<30;i++)assert.equal(await consumePrivateBudget(sql,'private',capability,null),true);
 assert.equal(await consumePrivateBudget(sql,'private',capability,null),false);assert.equal(await consumePrivateBudget(sql,'private',token(),null),true);
 assert.equal(await consumePrivateBudget(sql,'report',capability,null),true,'Independent operation budget');
 const buckets=await sql`select bucket from attempts`;assert.ok(buckets.every(r=>/^abuse:[\w:]+:[a-f0-9]{64}$/.test(r.bucket)));assert.ok(!JSON.stringify(buckets).includes(shared));assert.ok(!JSON.stringify(buckets).includes(capability));assert.notEqual(abuseBucket('private','same'),abuseBucket('report','same'));
 const before=(await sql`select count(*)::int as n from attempts`)[0].n;
 assert.ok((await submitPrivateRegistration('invalid',new FormData())).error);assert.equal((await sql`select count(*)::int as n from attempts`)[0].n,before);
 const missing=token();await submitPrivateRegistration(missing,new FormData());assert.equal((await sql`select sum(count)::int as n from attempts where bucket=${abuseBucket('private:token',missing)}`)[0].n,1,'Invalid valid-shaped capability does not roll back counter');
 assert.throws(()=>assertDemoHost('external.example.test'),/Configuración/);
 await assert.rejects(()=>requestContext.run({cookies:{'asvo-demo':'general'},headers:{host:'external.example.test'}},()=>staff()),/Configuración/);
 let requests=0;await assert.rejects(()=>graphMail({env:{},request:async()=>{requests++;throw Error('Should not call');}}).authenticate(),/Configuración/);assert.equal(requests,0);assert.equal(network,0);
 console.log('OK: revocación/alcance/vigencia/replay, retención sin borrado, autorización, límites concurrentes y redes compartidas, HMAC, demo host y configuración antes de red.');
}finally{globalThis.fetch=originalFetch;await sql.end();}
