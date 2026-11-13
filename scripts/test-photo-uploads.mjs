import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';requireDisposableTestDatabase();
import {registerHooks,stripTypeScriptTypes} from 'node:module';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';import sharp from 'sharp';
import {requestContext} from '../tests/authorization/request-context.mjs';
registerHooks({resolve(s,c,next){if(['next/headers','next/cache','next/navigation','next-auth'].includes(s))return next(new URL('../tests/authorization/request-context.mjs',import.meta.url).href,c);if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const path=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(path)))return next(path.href,c);}return next(s,c);},load(url,c,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8'),{mode:'strip',sourceUrl:url}),shortCircuit:true};return next(url,c);}});
const {sql}=await import('../lib/db.ts');
const {preparePhoto,graphPhotoStore}=await import('../lib/outing-photos.ts');
const {withPhotoUploads,cleanupPhotoOrphans,PhotoUploadError}=await import('../lib/photo-upload-workflow.ts');
const {saveOutingEditor,outingEditVersion}=await import('../lib/outing-editor.ts');
const {authorizePhotoMutation,savePhotoMutation}=await import('../lib/photo-mutation.ts');
const {saveOutingCreation,authorizeCreationPhotos}=await import('../lib/outing-creation.ts');
const {canOperate}=await import('../lib/authorization.ts');
const {GET}=await import('../app/api/fotos/[id]/route.ts');
const remote=new Map();let calls=0,puts=0,deletes=0,checkLocks=false,putMode='',onPut=null,onDelete=null;
let monitored='';
const fakeFetch=async(url,options={})=>{
 calls++;assert.ok(String(url).startsWith('https://graph.microsoft.com/')||String(url).startsWith('https://login.microsoftonline.com/'));
 if(checkLocks&&monitored)await sql.begin(async tx=>{await tx`select id from outings where id=${monitored} for update nowait`;await tx`select id from requests where id=(select request_id from outings where id=${monitored}) for update nowait`;await tx`select id from photo_upload_items for update nowait`;});
 if(String(url).includes('/token'))return Response.json({access_token:'fictitious-token'});
 const path=decodeURIComponent(new URL(url).pathname),match=/\/items\/([^:]+):\/([^:]+)(?::\/content)?$/.exec(path);
 if(options.method==='PUT'){
  puts++;if(onPut){const callback=onPut;onPut=null;await callback();}
  if(putMode==='failure')return new Response('',{status:500});
  const row={id:'item-'+randomUUID(),name:match[2],eTag:'"v1"',parentReference:{id:match[1]}};
  if(putMode!=='timeout-empty')remote.set(row.name,row);
  if(putMode.startsWith('timeout'))return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Synthetic timeout','TimeoutError'));if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true});});
  if(putMode==='malformed')return Response.json({});
  return Response.json(row);
 }
 if(options.method==='DELETE'){
  deletes++;const entry=[...remote].find(([,row])=>path.endsWith('/'+row.id));
  if(onDelete){const callback=onDelete;onDelete=null;await callback(entry?.[1]);}
  if(putMode==='delete-failure')return new Response('',{status:503});
  if(!entry)return new Response(null,{status:404});assert.equal(options.headers['If-Match'],entry[1].eTag);remote.delete(entry[0]);return new Response(null,{status:204});
 }
 const row=remote.get(match[2]);return row?Response.json(row):new Response(null,{status:404});
};
const store=graphPhotoStore({fetch:fakeFetch,config:()=>({tenant:'test',client:'test',secret:'test-only',drive:'drive',folder:'folder'}),demo:false,timeoutMs:30});
const actor={subject:'photos-fictitious',grants:[{role:'general',unit:''}]};
const form=values=>{const f=new FormData();for(const[k,value]of Object.entries(values))for(const v of Array.isArray(value)?value:[value])f.append(k,v);return f;};
const png=await sharp({create:{width:4,height:4,channels:3,background:'#456a36'}}).png().toBuffer();const file=()=>new File([png],'fictitious.png',{type:'image/png'});
async function outing(unit='Voluntariado General',request=null){
 request??=randomUUID();const id=randomUUID();await sql`insert into requests(id,organization,activity)values(${request},'DEMO fotos','Ficticia')on conflict do nothing`;
 await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${id},${request},'DEMO fotos','Ficticio',${unit},'2035-01-10','2035-01-12',true,3,'abierta',false)`;return {id,request};
}
const optionsFor=(id,f,extra={})=>({sql,principal:actor,scope:'test-photo:'+id,form:f,files:[{key:'upload',file:f.get('photo')}],store,prepare:preparePhoto,
 authorize:(tx,user)=>authorizePhotoMutation(tx,id,user),validate:(tx,user)=>savePhotoMutation(tx,id,f,user,{preflightOnly:true}),
 commit:async(tx,user,uploads,snapshot)=>{await savePhotoMutation(tx,id,f,user,{expectedVersion:String(snapshot),prepared:uploads.get('upload')});return {saved:true};},...extra});
const add=()=>form({action:'agregar',photo:file(),alt:'Foto ficticia',credit:'ASVO DEMO',permission:'on',photoOperation:randomUUID()});
const countPhotos=async id=>(await sql`select count(*)::int as n from outing_photos where outing_id=${id} and position is not null`)[0].n;
try{
 assert.deepEqual((await sql`select id from asvo_schema_migrations order by id`).map(r=>r.id),['0001_initial','0002_photo_upload_lifecycle','0003_mail_attempt_outcomes','0004_private_link_revocation']);
 await sql`insert into grants(subject,role,unit)values(${actor.subject},'general','')`;
 const o=await outing();monitored=o.id;
 // Actual provider adapter, fake Graph; NOWAIT proves that provider calls do not retain row locks.
 checkLocks=true;const f=add(),before=[...f],first=await withPhotoUploads(optionsFor(o.id,f));assert.equal(first.saved,true);assert.equal(await countPhotos(o.id),1);assert.deepEqual([...f],before);
 const firstPuts=puts;assert.equal((await withPhotoUploads(optionsFor(o.id,f))).saved,true);assert.equal(puts,firstPuts);assert.equal(await countPhotos(o.id),1);
 const row=(await sql`select * from outing_photos where outing_id=${o.id}`)[0];assert.equal(row.position,1);assert.equal(row.alt,'Foto ficticia');assert.equal(row.credit,'ASVO DEMO');
 checkLocks=false;
 // No permissions => no byte preparation, no provider and no durable upload side effect.
 let prepared=0;const priorCalls=calls;
 await assert.rejects(()=>withPhotoUploads(optionsFor(o.id,add(),{principal:{subject:'unauthorized',grants:[]},prepare:async value=>{prepared++;return preparePhoto(value);}})),/Acceso denegado/);assert.equal(prepared,0);assert.equal(calls,priorCalls);
 // Invalid images stay in the original FormData and errors name their specific file.
 const bad=add();bad.set('photo',new File(['not-image'],'bad.png',{type:'image/png'}));await assert.rejects(()=>withPhotoUploads(optionsFor(o.id,bad)),error=>error instanceof PhotoUploadError&&!!error.fieldErrors['upload-photo']);assert.ok(bad.get('photo') instanceof File);
 const invalidFiles=[{key:'first',file:new File(['x'],'first.png')},{key:'second',file:new File(['y'],'second.png')}];
 await assert.rejects(()=>withPhotoUploads(optionsFor(o.id,add(),{files:invalidFiles})),error=>error instanceof PhotoUploadError&&Object.keys(error.fieldErrors).length===2&&!!error.fieldErrors['first-photo']&&!!error.fieldErrors['second-photo']);
 // A rejected provider request preserves the selected file and permits retry.
 const failedPut=add();putMode='failure';await assert.rejects(()=>withPhotoUploads(optionsFor(o.id,failedPut)),PhotoUploadError);putMode='';assert.ok(failedPut.get('photo') instanceof File);
 // Concurrent version change during PUT: compensate only the new original.
 const conflict=add(),priorPhotos=await countPhotos(o.id),priorDeletes=deletes;
 onPut=async()=>{await sql`update outings set title='Cambio concurrente' where id=${o.id}`;};
 await assert.rejects(()=>withPhotoUploads(optionsFor(o.id,conflict)),/cambiaron/);assert.equal(await countPhotos(o.id),priorPhotos);assert.equal(deletes,priorDeletes+1);assert.ok([...remote.values()].some(item=>item.id===row.original_item));
 // Permission revocation during IO is checked again in the confirmation transaction.
 onPut=async()=>{await sql`delete from grants where subject=${actor.subject}`;};await assert.rejects(()=>withPhotoUploads(optionsFor(o.id,add())),/Acceso denegado/);await sql`insert into grants(subject,role,unit)values(${actor.subject},'general','')`;assert.equal(await countPhotos(o.id),priorPhotos);
 // A successful upload followed by a database failure is cleaned; retry can confirm once.
 const retry=add();let fail=true;const base=optionsFor(o.id,retry);
 await assert.rejects(()=>withPhotoUploads({...base,commit:async(...args)=>{if(fail)throw Error('Synthetic confirmation failure');return base.commit(...args);}}),/Synthetic/);fail=false;
 assert.equal((await withPhotoUploads(base)).saved,true);assert.equal((await withPhotoUploads(base)).saved,true);assert.equal(await countPhotos(o.id),priorPhotos+1);
 // Limits are rechecked after external IO; a concurrent sixth photo wins without a seventh reference.
 const full=await outing();
 for(let position=1;position<=5;position++)await sql`insert into outing_photos(outing_id,position,alt,credit,thumbnail,display_image)values(${full.id},${position},'Ficticia','',${png},${png})`;
 onPut=async()=>{await sql`insert into outing_photos(outing_id,position,alt,credit,thumbnail,display_image)values(${full.id},6,'Concurrente','',${png},${png})`;};
 await assert.rejects(()=>withPhotoUploads(optionsFor(full.id,add())),/seis fotos/);assert.equal(await countPhotos(full.id),6);
 const noCalls=calls;await assert.rejects(()=>withPhotoUploads(optionsFor(full.id,add())),/seis fotos/);assert.equal(calls,noCalls);
 // Ignored uploads cannot become permanent orphan originals just because the operation committed.
 const ignored=add(),ignoredPuts=puts,ignoredDeletes=deletes;
 await withPhotoUploads({...optionsFor(o.id,ignored),commit:async()=>({saved:true})});assert.equal(puts,ignoredPuts+1);assert.equal(deletes,ignoredDeletes+1);
 // A lost COMMIT acknowledgement returns its persisted result rather than deleting confirmed originals.
 const ack=add();let committed=false,lose=true;const baseAck=optionsFor(o.id,ack);
 const ackSql=new Proxy(sql,{get(target,key){if(key==='begin')return async callback=>{const result=await target.begin(callback);if(committed&&lose){lose=false;throw Error('Synthetic lost acknowledgement');}return result;};return Reflect.get(target,key);}});
 const countBeforeAck=await countPhotos(o.id),deletesBeforeAck=deletes;
 assert.equal((await withPhotoUploads({...baseAck,sql:ackSql,commit:async(...args)=>{const result=await baseAck.commit(...args);committed=true;return result;}})).saved,true);
 assert.equal(await countPhotos(o.id),countBeforeAck+1);assert.equal(deletes,deletesBeforeAck);
 // Unknown PUT results keep the generated path, even if the first later lookup is 404.
 const timeout=add();putMode='timeout-empty';await assert.rejects(()=>withPhotoUploads(optionsFor(o.id,timeout)),PhotoUploadError);putMode='';
 const [unknown]=await sql`select * from photo_upload_items where state='cleanup' and uncertain order by created_at desc limit 1`;
 await sql`update photo_upload_items set retry_at=now()-interval '1 second' where id=${unknown.id}`;await cleanupPhotoOrphans(sql,store);
 assert.equal((await sql`select state from photo_upload_items where id=${unknown.id}`)[0].state,'cleanup');
 remote.set(unknown.name,{id:'late-'+randomUUID(),name:unknown.name,eTag:'"late"',parentReference:{id:'folder'}});await sql`update photo_upload_items set retry_at=now()-interval '1 second' where id=${unknown.id}`;await cleanupPhotoOrphans(sql,store);assert.equal(remote.has(unknown.name),false);
 // Malformed 200 after a real fake PUT is also compensable by its durable path.
 putMode='malformed';await assert.rejects(()=>withPhotoUploads(optionsFor(o.id,add())),PhotoUploadError);putMode='';await sql`update photo_upload_items set retry_at=now()-interval '1 second' where state='cleanup'`;await cleanupPhotoOrphans(sql,store);
 // Existing/gallery/shared references must never be deleted. Protect even inactive gallery rows.
 const shared=await outing();await sql`insert into outing_photos(outing_id,position,alt,credit,original_drive,original_item,thumbnail,display_image)select ${shared.id},null,alt,credit,original_drive,original_item,thumbnail,display_image from outing_photos where id=${row.id}`;
 await sql`update photo_upload_items set state='cleanup',retry_at=now()-interval '1 second' where item=${row.original_item}`;
 const d=deletes;await cleanupPhotoOrphans(sql,store);assert.equal(deletes,d);assert.equal((await sql`select state from photo_upload_items where item=${row.original_item}`)[0].state,'protected');
 // Deletion fencing: a reference cannot appear after cleanup commits its claim.
 const fenced=add();putMode='delete-failure';await assert.rejects(()=>withPhotoUploads({...optionsFor(o.id,fenced),commit:async()=>{throw Error('Fence fixture');}}),/Fence fixture/);putMode='';
 const [pending]=await sql`select * from photo_upload_items where state='cleanup' and not uncertain order by created_at desc limit 1`;
 onDelete=async external=>{await assert.rejects(()=>sql`insert into outing_photos(outing_id,position,alt,credit,original_drive,original_item,thumbnail,display_image)values(${shared.id},1,'Ficticia','',${pending.drive},${external.id},${Buffer.from('x')},${Buffer.from('x')})`,/pendiente de limpieza/);};
 await sql`update photo_upload_items set retry_at=now()-interval '1 second' where id=${pending.id}`;await cleanupPhotoOrphans(sql,store);
 // Long PUT does not block a second operation. Expired leases fence late confirmation.
 const long=add();let release,entered;const started=new Promise(resolve=>entered=resolve),wait=new Promise(resolve=>release=resolve);
 onPut=async()=>{entered();await wait;};const running=withPhotoUploads(optionsFor(o.id,long));await started;
 await sql.begin(async tx=>{await tx`select id from outings where id=${o.id} for update nowait`;});
 await assert.rejects(()=>withPhotoUploads(optionsFor(o.id,long)),/todavía está en proceso/);
 await sql`update photo_upload_operations set lease_until=now()-interval '1 second' where state='uploading'`;await cleanupPhotoOrphans(sql,store);release();await assert.rejects(()=>running,/carga cambió o venció/);
 // Editor: source permissions, metadata/cover order, inheritance/personalization still use the real service.
 const editor=await outing(),editorSibling=await outing('Voluntariado General',editor.request);
 await sql`insert into request_outing_photos(request_id,position,alt,credit,thumbnail,display_image)values(${editor.request},1,'General','ASVO',${Buffer.from('x')},${Buffer.from('x')})`;
 await sql`update requests set outing_photos_initialized=true where id=${editor.request}`;
 const e=form({version:await outingEditVersion(sql,editor.id),title:'DEMO fotos',location:'Ficticio',unit:'Voluntariado General',personal:['title','location','unit'],starts:'2035-01-10',ends:'2035-01-12',mode:'flexible',capacity:'3',visibility:'privada',registrationDeadline:'2035-01-10',photoMode:'personal',photos:JSON.stringify([{key:'new-e',kind:'upload',alt:'Editor',credit:'Crédito',permission:true}]),'photo-new-e':file(),photoOperation:randomUUID()});
 await withPhotoUploads({...optionsFor(editor.id,e),scope:'editor:'+editor.id,files:[{key:'new-e',file:e.get('photo-new-e')}],
  validate:async(tx,user)=>{await saveOutingEditor(tx,editor.id,e,{actor:user.subject,canOperate:unit=>canOperate(user,unit),preflightOnly:true});return null;},
  commit:async(tx,user,uploads)=>{await saveOutingEditor(tx,editor.id,e,{actor:user.subject,canOperate:unit=>canOperate(user,unit),uploads});return {saved:true};},
 });assert.equal((await sql`select alt from outing_photos where outing_id=${editor.id} and position=1`)[0].alt,'Editor');assert.ok((await sql`select outing_overrides from outings where id=${editor.id}`)[0].outing_overrides.includes('photos'));
 e.set('version',await outingEditVersion(sql,editor.id));e.set('photoMode','inherit');await sql.begin(tx=>saveOutingEditor(tx,editor.id,e,{actor:actor.subject,canOperate:()=>true,uploads:new Map()}));assert.equal((await sql`select alt from outing_photos where outing_id=${editor.id} and position=1`)[0].alt,'General');
 // New outings upload once and share the original across dated blocks and their general photos.
 const create=form({title:'Nueva ficticia',location:'Lugar',unit:'Voluntariado General',starts:['2035-02-01','2035-02-08'],ends:['2035-02-02','2035-02-09'],periodId:['a','b'],capacity:'2',action:'publicar',visibility:'publica',registrationDeadline:'2035-02-01',photoCover:'new-0','photo-0':file(),'alt-0':'Portada','credit-0':'ASVO','permission-0':'on',photoOperation:randomUUID()});
 const creation={sql,principal:actor,scope:'create-outing',form:create,files:[{key:'new-0',file:create.get('photo-0')}],store,prepare:preparePhoto,
  authorize:(tx,user)=>authorizeCreationPhotos(tx,create,user),validate:(tx,user)=>saveOutingCreation(tx,create,user,{preflightOnly:true}),commit:(tx,user,uploads,snapshot)=>saveOutingCreation(tx,create,user,{uploads,expectedSnapshot:snapshot.snapshot})};
 const beforePuts=puts;const created=await withPhotoUploads(creation);assert.ok(created.destination);assert.equal(puts,beforePuts+1);assert.equal((await withPhotoUploads(creation)).destination,created.destination);assert.equal(puts,beforePuts+1);
 const blocks=await sql`select p.original_item from outing_photos p join outings o on o.id=p.outing_id where o.title='Nueva ficticia'`;assert.equal(blocks.length,2);assert.equal(new Set(blocks.map(p=>p.original_item)).size,1);
 // GET returns denied photos without exposing bytes; public and staff cases remain covered by authorization suite.
 const denied=await outing('BRIF');const photo=randomUUID();await sql`insert into outing_photos(id,outing_id,position,alt,credit,thumbnail,display_image)values(${photo},${denied.id},1,'Ficticia','',${png},${png})`;await sql`update outings set registration_deadline='2000-01-01' where id=${denied.id}`;
 assert.equal((await requestContext.run({cookies:{}},()=>GET(new Request('http://localhost/api/fotos/'+photo),{params:Promise.resolve({id:photo})}))).status,404);
 assert.equal((await sql`select count(*)::int as n from registration_mail_outbox`)[0].n,0);
 console.log('OK: Graph simulado sin bloqueos, autorización previa, revalidación, reintentos, tiempos de espera/cargas tardías, compensación durable, referencias compartidas/fencing, editor/herencia y creación por bloques. Cero proveedores reales.');
}finally{await sql.end();}
