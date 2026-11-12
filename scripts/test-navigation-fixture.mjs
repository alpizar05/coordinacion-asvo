// Disposable local UI fixtures. Never use against beta; no mail-dispatch function is imported.
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import postgres from 'postgres';
const url=new URL(process.env.DATABASE_URL);
if(process.env.ASVO_DEMO!=='1'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Solo demo local');
const sql=postgres(process.env.DATABASE_URL,{max:1}),file=new URL('../.env.navigation-fixture.json',import.meta.url);
try{
 if(process.argv[2]==='prepare'){
  try{await readFile(file);throw Error('Limpiá primero el fixture anterior');}catch(error){if(error.code!=='ENOENT')throw error;}
  const fixture={request:randomUUID(),outing:randomUUID(),empty:randomUUID(),manual:randomUUID(),summaryOuting:randomUUID(),pastOuting:randomUUID(),summaryEntries:Array.from({length:3},()=>randomUUID()),people:Array.from({length:28},()=>randomUUID()),entries:Array.from({length:6},()=>randomUUID())};
  await sql.begin(async tx=>{
   await tx`insert into requests(id,organization,activity) values(${fixture.request},'DEMO Navegación','Pruebas locales de contexto')`;
   for(const [id,title] of [[fixture.outing,'DEMO Navegación · Inscripciones'],[fixture.empty,'DEMO Navegación · Eliminar']])await tx`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${id},${fixture.request},${title},'Local','Voluntariado General','2035-01-10','2035-01-12',false,12,'abierta',false)`;
   for(let i=0;i<fixture.people.length;i++){
    const id=fixture.people[i];
    await tx`insert into volunteers(id,identification,name,surname,email,units)values(${id},${'9'+String(i).padStart(8,'0')},'Navegacion',${'Prueba '+String(i+1).padStart(2,'0')},${id+'@example.test'},array['Voluntariado General'])`;
    await tx`insert into policies(volunteer_id,kind,number,starts,ends,verified_at)values(${id},'DEMO','DEMO','2020-01-01','2035-12-31',now())`;
    if(i<fixture.entries.length)await tx`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,received_at,details)values(${fixture.entries[i]},${fixture.outing},${id},${'9'+String(i).padStart(8,'0')},'2035-01-10','2035-01-12','revisión',now()-(${i}::int*interval '1 minute'),'{}'::jsonb)`;
   }
   for(const [id,title,delta] of [[fixture.summaryOuting,'DEMO Navegación · Resumen',2],[fixture.pastOuting,'DEMO Navegación · Informe pendiente',-4]])await tx`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${id},${fixture.request},${title},'Local','Voluntariado General',((now() at time zone 'America/Costa_Rica')::date+${delta}::int),((now() at time zone 'America/Costa_Rica')::date+${delta+1}::int),false,12,'abierta',false)`;
   for(let i=0;i<3;i++)await tx`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,received_at,details)select ${fixture.summaryEntries[i]},id,${fixture.people[i]},${'9'+String(i).padStart(8,'0')},starts,ends,${i<2?'confirmada':'revisión'},now(),${{transporte:true,ofreceTransporte:2,alimentacion:'Restricción ficticia DEMO'}}::jsonb from outings where id=${fixture.summaryOuting}`;
   await tx`insert into outing_collections(id,name,description,created_by)values(${fixture.manual},'DEMO Navegación · Serie manual','Prueba local','local-coordination')`;
   await tx`insert into outing_collection_members(collection_id,outing_id)values(${fixture.manual},${fixture.outing})`;
   await tx`update registrations set status='confirmada',details=jsonb_build_object('assigned70',true)where id=${fixture.entries[0]}`;
   await tx`insert into outing_reports(outing_id,lead_registration_id,lead_name,lead_email,labour,location,activity,starts,ends,actions,host,participants,status)values(${fixture.outing},${fixture.entries[0]},'Navegacion Prueba 01',${fixture.people[0]+'@example.test'},'Mantenimiento','Local','Prueba','2035-01-10','2035-01-12','Borrador ficticio','Ficticio','[]'::jsonb,'borrador')`;
  });
  await writeFile(file,JSON.stringify(fixture));console.log('Fixture local creado: 28 personas ficticias, seis inscripciones y cuatro salidas. Sin envío de mensajes.');
 }else if(process.argv[2]==='restore-empty'){
  const f=JSON.parse(await readFile(file));await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${f.empty},${f.request},'DEMO Navegación · Eliminar','Local','Voluntariado General','2035-01-10','2035-01-12',false,12,'abierta',false)on conflict(id)do nothing`;
  console.log('Restaurada solo la salida ficticia de eliminación.');
 }else if(['logistics-next','logistics-empty','logistics-reset'].includes(process.argv[2])){
  const f=JSON.parse(await readFile(file)),mode=process.argv[2];
  await sql`update policies set starts='2020-01-01' where volunteer_id=any(${f.people}::uuid[])`;
  await sql`update registrations set details=${mode==='logistics-reset'?{transporte:true,ofreceTransporte:2,alimentacion:'Restricción ficticia DEMO'}:{}}::jsonb where id=any(${mode==='logistics-next'?[f.summaryEntries[0]]:f.summaryEntries}::uuid[])`;
  console.log('Actualizados solo los datos ficticios de logística. Sin correos.');
 }else if(process.argv[2]==='grow'){
  const f=JSON.parse(await readFile(file));await sql.begin(async tx=>{
   for(let i=25;i<f.people.length;i++){const id=f.people[i];await tx`insert into volunteers(id,identification,name,surname,email,units)values(${id},${'9'+String(i).padStart(8,'0')},'Navegacion',${'Prueba '+String(i+1).padStart(2,'0')},${id+'@example.test'},array['Voluntariado General'])on conflict(id)do nothing`;}
  });console.log('Restauradas tres personas ficticias para repetir la prueba de página.');
 }else if(process.argv[2]==='shrink'){
  const fixture=JSON.parse(await readFile(file));
  await sql.begin(async tx=>{await tx`delete from policies where volunteer_id=any(${fixture.people.slice(25)}::uuid[])`;await tx`delete from volunteers where id=any(${fixture.people.slice(25)}::uuid[])`;});
  console.log('Eliminadas solo las tres personas ficticias de la última página.');
 }else if(process.argv[2]==='cleanup'){
  const f=JSON.parse(await readFile(file));
  f.entries.push(...(f.summaryEntries??[]));
  const allOutings=[f.outing,f.empty,f.summaryOuting,f.pastOuting].filter(Boolean);
  const [{sent}]=await sql`select count(*)::int as sent from registration_mail_outbox where registration_id=any(${f.entries}::uuid[])and sent_at is not null`;if(sent)throw Error('La comprobación requiere cero correos reales enviados');
  await sql.begin(async tx=>{
   await tx`delete from demo_mail where registration_id=any(${f.entries}::uuid[])`;
   await tx`delete from links where registration_id=any(${f.entries}::uuid[])`;
   await tx`delete from registration_mail_outbox where registration_id=any(${f.entries}::uuid[])`;
   await tx`delete from audit where target=any(${[...f.entries,...f.people,f.request,...allOutings]}::text[])`;
   await tx`delete from outing_reports where outing_id=any(${allOutings}::uuid[])`;
   await tx`delete from outing_collection_members where collection_id=${f.manual}`;
   await tx`delete from outing_collections where id=${f.manual}`;
   await tx`delete from registrations where id=any(${f.entries}::uuid[])`;
   await tx`delete from policies where volunteer_id=any(${f.people}::uuid[])`;
   await tx`delete from volunteers where id=any(${f.people}::uuid[])`;
   await tx`delete from outings where id=any(${allOutings}::uuid[])`;
   await tx`delete from requests where id=${f.request}`;
  });await unlink(file);console.log('Verificado: cero correos reales enviados. Fixture y auditoría/notificaciones demo asociados eliminados.');
 }else throw Error('Usá prepare, shrink o cleanup');
}finally{await sql.end();}
