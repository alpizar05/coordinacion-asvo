import { prepareDatabase } from '../lib/database-setup.mjs';
import postgres from 'postgres';
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { planHistoricalImport,safeBetaEmail,photoKeys,BETA_IDENTIFICATIONS } from '../lib/historical-import-plan.mjs';

const args=Object.fromEntries(process.argv.slice(2).filter(v=>v.startsWith('--')&&v.includes('=')).map(v=>{const i=v.indexOf('=');return [v.slice(2,i),v.slice(i+1)];}));
const apply=process.argv.includes('--apply');
const input=resolve(args.input || '../outputs/migracion-coordinacion-2026/migracion-voluntariado-2026.json');
const bytes=await readFile(input),data=JSON.parse(bytes);
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const plan=planHistoricalImport(data,bytes,today);
const origin=new URL(process.env.APP_URL).origin;
const host=new URL(process.env.DATABASE_URL).hostname;
const local=['localhost','127.0.0.1','[::1]'].includes(host);
if(local ? process.env.ASVO_DEMO!=='1' : origin!=='https://coordinacion-asvo.vercel.app'||!host.endsWith('.neon.tech'))throw new Error('Destino de importación no autorizado');
const sql=postgres(process.env.DATABASE_URL,{max:1,connect_timeout:30,onnotice:()=>{}});
const actor='migracion-beta-autorizada';
const stableId=key=>{const h=createHash('sha256').update(`${plan.batch}:${key}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const reason=`Migración histórica DEMO 2026, lote ${plan.batch}. No genera notificaciones ni acredita póliza o asistencia no verificada.`;
let token;
async function graph(path,options={}){
 if(!token){
  const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(process.env.GRAPH_TENANT_ID)}/oauth2/v2.0/token`,{
   method:'POST',body:new URLSearchParams({client_id:process.env.GRAPH_CLIENT_ID,client_secret:process.env.GRAPH_CLIENT_SECRET,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`SharePoint autenticación HTTP ${response.status}`);
  token=(await response.json()).access_token;
 }
 const response=await fetch(`https://graph.microsoft.com/v1.0${path}`,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers},signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw new Error(`SharePoint HTTP ${response.status}`);
 return response.json();
}
async function uploadPhotos(){
 const directory=args['photos-dir'];
 if(!directory)throw new Error('Falta --photos-dir');
 const files={montezuma:'montezuma.png',general:'general.jpeg',tortuguero:'tortuguero.jpg',uea:'uea.jpg',covirenas:'covirenas.jpg',brif:'brif.jpg'};
 const alts={montezuma:'Voluntariado en la estación ASVO Montezuma',general:'Equipo de Voluntariado General de ASVO',tortuguero:'Voluntariado de ASVO en Tortuguero',uea:'Actividad de educación ambiental de ASVO',covirenas:'Equipo de Control y Protección/COVIRENAS de ASVO',brif:'Equipo BRIF de ASVO en campo'};
 const saved=await sql`select photo_key,source_sha256 from historical_import_photos where batch_id=${plan.batch}`;
 for(const key of photoKeys){
  const original=await readFile(join(directory,files[key]));
  const sha=createHash('sha256').update(original).digest('hex');
  const existing=saved.find(p=>p.photo_key===key);
  if(existing){if(existing.source_sha256!==sha)throw new Error('La imagen del lote cambió');continue;}
  const source=sharp(original,{limitInputPixels:30000000});
  const [thumbnail,display]=await Promise.all([
   source.clone().autoOrient().resize(560,350,{fit:'cover',withoutEnlargement:true}).webp({quality:76}).toBuffer(),
   source.clone().autoOrient().resize(1440,1100,{fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer()]);
  let drive=process.env.SHAREPOINT_PHOTO_DRIVE_ID,item;
  if(local){drive='demo-local';item=`historical-${plan.batch}-${key}`;}
  else{
   if(!drive||!process.env.SHAREPOINT_PHOTO_FOLDER_ID)throw new Error('Falta carpeta SharePoint');
   const name=`${plan.batch}-${key}-${sha.slice(0,12)}.${files[key].split('.').at(-1)}`;
   const uploaded=await graph(`/drives/${encodeURIComponent(drive)}/items/${encodeURIComponent(process.env.SHAREPOINT_PHOTO_FOLDER_ID)}:/${encodeURIComponent(name)}:/content`,{
    method:'PUT',headers:{'Content-Type':key==='montezuma'?'image/png':'image/jpeg'},body:original});
   if(!uploaded.id)throw new Error('SharePoint no devolvió identificador');item=uploaded.id;
  }
  await sql`insert into historical_import_photos(batch_id,photo_key,source_sha256,original_drive,original_item,thumbnail,display_image,alt,credit)
   values(${plan.batch},${key},${sha},${drive},${item},${thumbnail},${display},${alts[key]},'ASVO · imagen facilitada para la beta') on conflict do nothing`;
  console.log(JSON.stringify({photo:key,stored:true}));
 }
}
async function validate(tx){
 const rows=await tx`select entity,state,count(*)::int as count from historical_import_records where batch_id=${plan.batch} group by entity,state`;
 const counts={};for(const row of rows)counts[`${row.entity}:${row.state}`]=row.count;
 for(const [entity,total] of Object.entries({volunteer:167,request:329,outing:329,registration:837,report:129})){
  if(rows.filter(r=>r.entity===entity).reduce((n,r)=>n+r.count,0)!==total)throw new Error(`Conteo staging inválido: ${entity}`);
 }
 const [relations]=await tx`select count(*)::int as registrations,
  count(*) filter(where v.identification=r.identification and r.outing_id=(h.payload->>'outing_id')::uuid)::int as valid_relations,
  count(*) filter(where (h.payload->>'demo_generated')::boolean is true and r.received_at is null)::int as demo_without_received,
  count(*) filter(where r.details->'assigned70'='true'::jsonb)::int as leads
  from historical_import_records h join registrations r on r.id=h.target_id join volunteers v on v.id=r.volunteer_id
  where h.batch_id=${plan.batch} and h.entity='registration'`;
 if(relations.registrations!==837||relations.valid_relations!==837||relations.demo_without_received!==17||relations.leads!==105)throw new Error('Relaciones o procedencia de inscripciones inválidas');
 const [reports]=await tx`select count(*)::int as operational,
  count(*) filter(where lead.outing_id=p.outing_id and lead.details->'assigned70'='true'::jsonb)::int as valid_leads,
  count(*) filter(where p.participants='[]'::jsonb)::int as unasserted_attendance
  from historical_import_records h join outing_reports p on p.id=h.target_id join registrations lead on lead.id=p.lead_registration_id
  where h.batch_id=${plan.batch} and h.entity='report'`;
 if(reports.operational!==plan.operational.length||reports.valid_leads!==reports.operational||reports.unasserted_attendance!==reports.operational)throw new Error('Informes sin responsable válido o asistencia inventada');
 const [links]=await tx`select count(*)::int as links,count(*) filter(where confidence='Probable' and state='pendiente' and not human_approved)::int as probable_pending
   from historical_import_report_links where batch_id=${plan.batch}`;
 if(links.links!==155||links.probable_pending!==50)throw new Error('Vínculos de informes inválidos');
 const [photos]=await tx`select count(*)::int as covers,count(distinct p.original_item)::int as unique_images from historical_import_records h
   join outing_photos p on p.outing_id=h.target_id and p.position=1 where h.batch_id=${plan.batch} and h.entity='outing'`;
 if(photos.covers!==329||photos.unique_images!==6)throw new Error('Portadas incompletas');
 const [mail]=await tx`select (select count(*) from registration_mail_outbox m join historical_import_records h on h.target_id=m.registration_id where h.batch_id=${plan.batch} and h.entity='registration')::int as outbox,
 (select count(*) from demo_mail m join historical_import_records h on h.target_id=m.registration_id where h.batch_id=${plan.batch} and h.entity='registration')::int as demo_mail,
 (select count(*) from report_reminders m join historical_import_records h on h.target_id=m.registration_id where h.batch_id=${plan.batch} and h.entity='registration')::int as reminders,
 (select count(*) from links m join historical_import_records h on h.target_id=m.registration_id where h.batch_id=${plan.batch} and h.entity='registration')::int as private_links`;
 if(Object.values(mail).some(n=>n!==0))throw new Error('La importación generó comunicaciones');
 const [dupes]=await tx`select count(*)::int as total from(select r.outing_id,r.volunteer_id,count(*) from registrations r join historical_import_records h on h.target_id=r.id
 where h.batch_id=${plan.batch} and h.entity='registration' and r.status in ('revisión','confirmada','espera') group by r.outing_id,r.volunteer_id having count(*)>1) d`;
 if(dupes.total)throw new Error('Inscripciones activas duplicadas');
 const [people]=await tx`select count(*)::int as people,count(*) filter(where v.units @> array['Voluntariado General'])::int as general,
 count(*) filter(where not (v.identification=any(${[...BETA_IDENTIFICATIONS]}::text[])) and v.email is not null and lower(btrim(v.email)) not like '%.test')::int as unsafe_emails
 from historical_import_records h join volunteers v on v.id=h.target_id where h.batch_id=${plan.batch} and h.entity='volunteer'`;
 if(people.people!==167||people.general!==167||people.unsafe_emails)throw new Error('Personas o protección de correo inválidas');
 const [visibility]=await tx`select count(*)::int as total,count(*) filter(where not o.listed)::int as private,
 count(*) filter(where o.listed)::int as public from historical_import_records h join outings o on o.id=h.target_id
 where h.batch_id=${plan.batch} and h.entity='outing'`;
 if(visibility.total!==329)throw new Error('Faltan convocatorias del lote');
 return {records:counts,relations,reports,links,photos,communications:mail,activeDuplicates:dupes.total,people,privateOutings:visibility.private,publicOutings:visibility.public};
}
try{
 if(process.env.IMPORT_TEST_SCHEMA){
  if(!local||!/^historical_import_test_[a-z0-9_]+$/.test(process.env.IMPORT_TEST_SCHEMA))throw new Error('Esquema de prueba inválido');
  await sql.unsafe(`create schema if not exists ${process.env.IMPORT_TEST_SCHEMA}`);
  await sql.unsafe(`set search_path to ${process.env.IMPORT_TEST_SCHEMA}`);
  await prepareDatabase(sql);
 }
 const existing=await sql`select id,identification from volunteers where identification in ${sql(data.volunteers.map(v=>v.identification))}`;
 console.log(JSON.stringify({mode:apply?'apply':'preview',batch:plan.batch,destination:local?'local':origin,...plan.summary,reusedPeople:existing.length,newPeople:167-existing.length}));
 if(!apply)process.exitCode=0;
 else{
  await sql.unsafe(await readFile(new URL('../historical-import.sql',import.meta.url),'utf8'));
  const metadata=Object.fromEntries(Object.entries(data).filter(([key])=>!['volunteers','requests','outings','registrations','reports','review_queue'].includes(key)));
  await sql`insert into historical_import_batches(id,sha256,metadata) values(${plan.batch},${plan.hash},${sql.json(metadata)}) on conflict do nothing`;
  const [batch]=await sql`select completed_at from historical_import_batches where id=${plan.batch}`;
  if(!batch.completed_at)await uploadPhotos();
  const result=await sql.begin(async tx=>{
   await tx`select pg_advisory_xact_lock(19720261110)`;
   const [locked]=await tx`select completed_at,summary from historical_import_batches where id=${plan.batch} for update`;
   if(locked.completed_at)return {alreadyImported:true,...locked.summary,validation:await validate(tx)};
   const old=await tx`select * from volunteers where identification in ${tx(data.volunteers.map(v=>v.identification))}`;
   const byIdentification=new Map(old.map(v=>[v.identification,v]));
   const personMap=new Map(data.volunteers.map(v=>[v.id,byIdentification.get(v.identification)?.id || v.id]));
   const records=[];
   const record=(entity,source_key,target_id,state,payload,notes={})=>records.push({batch_id:plan.batch,entity,source_key:String(source_key),target_id,state,payload:tx.json(payload),notes:tx.json(notes)});
   const newPeople=data.volunteers.filter(v=>!byIdentification.has(v.identification)).map(v=>({id:v.id,identification:v.identification,name:v.name,surname:v.surname,second_surname:v.second_surname||null,email:safeBetaEmail(v.email,v.identification),whatsapp:v.whatsapp||null}));
   if(newPeople.length)await tx`insert into volunteers ${tx(newPeople,'id','identification','name','surname','second_surname','email','whatsapp')}`;
   const contacts=data.volunteers.map(v=>({identification:v.identification,email:safeBetaEmail(v.email,v.identification),whatsapp:v.whatsapp||null}));
   await tx`update volunteers v set email=coalesce(nullif(btrim(v.email),''),c.email),whatsapp=coalesce(nullif(btrim(v.whatsapp),''),c.whatsapp)
    from jsonb_to_recordset(${tx.json(contacts)}) as c(identification text,email text,whatsapp text)
    where v.identification=c.identification`;
   for(const v of data.volunteers)record('volunteer',v.id,personMap.get(v.id),'importado',v,{reused:byIdentification.has(v.identification),previous:byIdentification.get(v.identification)||null,contact_not_verified:true});
   // Existing registry data and beta email masking take precedence; don't silently overwrite it.
   const existingPolicies=await tx`select * from policies where volunteer_id in ${tx([...personMap.values()])}`;
   const policyMap=new Map(),newPolicies=[];
   for(const v of data.volunteers){
    if(!v.policy?.number)continue;
    const personId=personMap.get(v.id),p=v.policy;
    const match=existingPolicies.filter(old=>old.volunteer_id===personId&&old.number===p.number)
      .sort((a,b)=>Number(!!b.verified_at)-Number(!!a.verified_at))[0];
    const policyId=match?.id||stableId(`policy:${v.id}`);policyMap.set(v.id,{id:policyId,starts:match?.starts?.toISOString?.().slice(0,10)||match?.starts||p.starts,ends:match?.ends?.toISOString?.().slice(0,10)||match?.ends||p.ends});
    if(!match)newPolicies.push({id:policyId,volunteer_id:personId,kind:'Poliza DEMO',number:p.number,starts:p.starts,ends:p.ends,source:reason,verified_by:null,verified_at:null});
    record('policy',v.id,policyId,'importado',p,{reused:!!match,new_policy_verified:false,existing_verification_preserved:!!match?.verified_at});
   }
   if(newPolicies.length)await tx`insert into policies ${tx(newPolicies,'id','volunteer_id','kind','number','starts','ends','source','verified_by','verified_at')}`;
   const requestRows=data.requests.map(r=>{
    const o=plan.outings.find(o=>o.request_id===r.id);
    record('request',r.id,r.id,'importado',r,{demo_request:true});
    return {id:r.id,organization:r.organization,contact:[r.contact,safeBetaEmail(r.contact_email,null)].filter(Boolean).join(' · '),area:r.area,activity:r.activity||o.activity_description||'Apoyo de voluntariado · DEMO',plan:r.plan||o.description||null,logistics:r.logistics||null,
     outing_defaults:tx.json({title:o.title,location:o.location,unit:o.unit,requirements:'',logistics:''}),outing_photos_initialized:true};
   });
   await tx`insert into requests ${tx(requestRows,'id','organization','contact','area','activity','plan','logistics','outing_defaults','outing_photos_initialized')}`;
   const outingRows=plan.outings.map(o=>{
    record('outing',o.id,o.id,'importado',data.outings.find(original=>original.id===o.id),o.assumptions);
    return {id:o.id,request_id:o.request_id,title:o.title,location:o.location,unit:o.unit,starts:o.starts,ends:o.ends,flexible:o.flexible,capacity:o.capacity,status:o.status,listed:false,requirements:'',logistics:'',registration_deadline:o.starts};
   });
   await tx`insert into outings ${tx(outingRows,'id','request_id','title','location','unit','starts','ends','flexible','capacity','status','listed','requirements','logistics','registration_deadline')}`;
   const registrationRows=data.registrations.map(r=>{
    const p=policyMap.get(r.volunteer_id),covered=!!(p?.starts&&p?.ends&&String(p.starts)<=r.starts&&String(p.ends)>=r.ends);
    record('registration',r.id,r.id,'importado',r,{policy_covers_dates:covered,lead_from_strong_report:plan.leadIds.has(r.id)});
    return {id:r.id,outing_id:r.outing_id,volunteer_id:personMap.get(r.volunteer_id),identification:r.identification,received_at:r.received_at,
     status:r.status_candidate,starts:r.starts,ends:r.ends,policy_id:covered?p.id:null,
     details:tx.json({...r.details,assigned70:plan.leadIds.has(r.id),historical_participation:r.historical_participation,
      historical_import:{batch:plan.batch,source_id:r.id,source_row:r.source_row,legacy_group:r.legacy_group,legacy_status:r.legacy_status,demo_generated:!!r.demo_generated,lead70_report_ids:r.lead70_report_ids}})};
   });
   await tx`insert into registrations ${tx(registrationRows,'id','outing_id','volunteer_id','identification','received_at','status','starts','ends','policy_id','details')}`;
   const reportRows=plan.operational.map(({report:r,outing,lead})=>{
    record('report',r.id,r.id,'importado',r,{association:'Fuerte analítico; asociación DEMO, no aprobación humana.',participants_pending_review:r.participant_candidates.length});
    return {id:r.id,outing_id:outing.id,lead_registration_id:lead.registration_id,lead_name:r.lead_name_candidate||r.lead_name_original||lead.name,
     lead_email:safeBetaEmail(r.lead_email,lead.identification)||'',labour:r.labour||'',labour_types:(r.labour||'').split(',').map(v=>v.trim()).filter(Boolean),
     location:r.location_original||outing.location,activity:r.activity||'',starts:r.starts_original_iso.slice(0,10),ends:r.ends_original_iso.slice(0,10),actions:r.actions||'',host:r.host||'',observations:r.observations||'',participants:tx.json([]),status:'finalizado',submitted_at:r.submitted_at,updated_at:r.submitted_at};
   });
   if(reportRows.length)await tx`insert into outing_reports ${tx(reportRows,'id','outing_id','lead_registration_id','lead_name','lead_email','labour','labour_types','location','activity','starts','ends','actions','host','observations','participants','status','submitted_at','updated_at')}`;
   for(const {report,reasons} of plan.staged)record('report',report.id,null,'pendiente',report,{reasons});
   for(const [key,queue]of Object.entries(data.review_queue))record('review_queue',key,null,'pendiente',queue,{count:queue.length});
   await tx`insert into historical_import_records ${tx(records,'batch_id','entity','source_key','target_id','state','payload','notes')}`;
   const operationalIds=new Set(plan.operational.map(r=>r.report.id));
   const linkRows=data.reports.flatMap(r=>r.group_links.map(l=>({batch_id:plan.batch,report_source_id:r.id,outing_id:l.outing_id,confidence:l.confidence,state:operationalIds.has(r.id)&&l.confidence==='Fuerte'?'asociado_demo':'pendiente',evidence:l.evidence,human_approved:false})));
   await tx`insert into historical_import_report_links ${tx(linkRows,'batch_id','report_source_id','outing_id','confidence','state','evidence','human_approved')}`;
   const photos=await tx`select * from historical_import_photos where batch_id=${plan.batch}`;
   const photoRows=plan.outings.map(o=>{const p=photos.find(p=>p.photo_key===o.photo);if(!p)throw new Error('Imagen faltante');return {id:stableId(`cover:${o.id}`),outing_id:o.id,position:1,alt:p.alt,credit:p.credit,original_item:p.original_item,original_drive:p.original_drive,thumbnail:p.thumbnail,display_image:p.display_image};});
   // Batch by image to avoid a large SQL argument list containing repeated buffers.
   for(const key of photoKeys){const rows=photoRows.filter(p=>plan.outings.find(o=>o.id===p.outing_id).photo===key);if(rows.length)await tx`insert into outing_photos ${tx(rows,'id','outing_id','position','alt','credit','original_item','original_drive','thumbnail','display_image')}`;}
   await tx`insert into request_outing_photos(request_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
    select o.request_id,p.position,p.alt,p.credit,p.original_item,p.original_drive,p.thumbnail,p.display_image from outing_photos p join outings o on o.id=p.outing_id
    join historical_import_records h on h.target_id=o.id and h.entity='outing' and h.batch_id=${plan.batch}`;
   const auditRows=data.registrations.map(r=>({actor,action:'Importó inscripción histórica',target:r.id,reason:`${reason} Origen: ${r.source_row ? `fila ${r.source_row}`:'inscripción DEMO autorizada, sin fecha de recepción original'}. Estado original: ${r.legacy_status||'no consta (DEMO)'}.`}));
   await tx`insert into audit ${tx(auditRows,'actor','action','target','reason')}`;
   await tx`insert into audit(actor,action,target,reason)values(${actor},'Importó migración histórica DEMO',${plan.batch},${reason})`;
   const validation=await validate(tx);
   const summary={...plan.summary,reusedPeople:old.length,newPeople:newPeople.length,reusedPolicies:policyMap.size-newPolicies.length,newUnverifiedPolicies:newPolicies.length,validation};
   await tx`update historical_import_batches set completed_at=now(),summary=${tx.json(summary)} where id=${plan.batch}`;
   return summary;
  });
  const output={batch:plan.batch,sha256:plan.hash,destination:local?'local':origin,completedAt:new Date().toISOString(),...result};
  if(args.output)await writeFile(resolve(args.output),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output));
 }
}catch(error){console.error(JSON.stringify({error:'La importación no se completó; los registros operativos de esta transacción se revirtieron.',code:error.code||null,message:error.code?'Revisar esquema/contrato sin imprimir datos personales.':error.message}));process.exitCode=1;}finally{await sql.end();}
