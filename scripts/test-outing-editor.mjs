import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import postgres from 'postgres';
const url=new URL(process.env.DATABASE_URL);
if(process.env.ASVO_DEMO!=='1'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Solo base demo local');
registerHooks({resolve(specifier,context,next){
 if(['next/headers','next/navigation','next/cache'].includes(specifier))return next(specifier+'.js',context);
 if(specifier.startsWith('.')&&context.parentURL&&!/\.[a-z]+$/.test(specifier)){const candidate=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(candidate)))return next(candidate.href,context);}
 return next(specifier,context);
}});
const {saveOutingEditor,outingEditVersion,OutingEditError}=await import('../lib/outing-editor.ts');
const sql=postgres(process.env.DATABASE_URL,{max:1});
const rollback=new Error('rollback-test');
try{
 await sql.begin(async tx=>{
  const request=randomUUID(),id=randomUUID();
  await tx`insert into requests(id,organization,activity,outing_defaults)values(${request},'DEMO prueba editor','Actividad',${tx.json({title:'Original',location:'Lugar',unit:'Voluntariado General',requirements:'',logistics:''})})`;
  await tx`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,registration_deadline)values(${id},${request},'Original','Lugar','Voluntariado General','2027-01-10','2027-01-11',true,2,'confirmada','2027-01-10')`;
  const options={actor:'local-admin',canOperate:()=>true,upload:async()=>{throw new Error('foto-fallida');}};
  async function form(){const f=new FormData();for(const[k,v]of Object.entries({version:await outingEditVersion(tx,id),starts:'2027-01-10',ends:'2027-01-11',mode:'flexible',capacity:'2',visibility:'publica',registrationDeadline:'2027-01-10',photoMode:'keep',title:'Nuevo'}))f.set(k,v);f.append('personal','title');return f;}
  const failed=await form();failed.set('capacity','0');
  await assert.rejects(()=>saveOutingEditor(tx,id,failed,options),e=>e instanceof OutingEditError&&e.target==='capacity');
  assert.equal((await tx`select title from outings where id=${id}`)[0].title,'Original');
  const stale=await form(),valid=await form();valid.set('starts','2027-01-09');valid.set('registrationDeadline','2027-01-09');valid.set('dateReason','Cambio coordinado');
  await saveOutingEditor(tx,id,valid,options);
  const [saved]=await tx`select title,starts::text,registration_deadline::text from outings where id=${id}`;
  assert.equal(saved.title,'Nuevo');assert.equal(saved.starts,'2027-01-09');assert.equal(saved.registration_deadline,'2027-01-09');
  await assert.rejects(()=>saveOutingEditor(tx,id,stale,options),e=>e.target==='form');
  const missingReason=await form();missingReason.set('capacity','3');missingReason.set('starts','2027-01-09');missingReason.set('registrationDeadline','2027-01-09');
  await assert.rejects(()=>saveOutingEditor(tx,id,missingReason,options),e=>e.target==='capacityReason');
  const photo=await form();photo.set('starts','2027-01-09');photo.set('registrationDeadline','2027-01-09');photo.set('title','No guardar');photo.set('photoMode','personal');photo.set('photos',JSON.stringify([{key:'new-test',kind:'upload',alt:'Prueba',credit:''}]));
  await assert.rejects(()=>saveOutingEditor(tx,id,photo,options),/foto-fallida/);
  assert.equal((await tx`select title from outings where id=${id}`)[0].title,'Nuevo');
  const first=randomUUID(),second=randomUUID(),sourceId=randomUUID(),galleryId=randomUUID();
  await tx`insert into outing_photos(id,outing_id,position,alt,credit,thumbnail,display_image)values(${first},${id},1,'Primera','',${Buffer.from('a')},${Buffer.from('a')}),(${second},${id},2,'Segunda','',${Buffer.from('b')},${Buffer.from('b')})`;
  await tx`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status)values(${sourceId},${request},'Galería','Lugar','Voluntariado General','2027-01-10','2027-01-11',false,1,'confirmada')`;
  await tx`insert into outing_photos(id,outing_id,position,alt,credit,thumbnail,display_image)values(${galleryId},${sourceId},1,'Galería','',${Buffer.from('c')},${Buffer.from('c')})`;
  const photoForm=await form();photoForm.set('starts','2027-01-09');photoForm.set('registrationDeadline','2027-01-09');photoForm.set('photoMode','personal');
  photoForm.set('photos',JSON.stringify([{key:second,kind:'existing',id:second,alt:'Nueva portada',credit:'ASVO'},{key:galleryId,kind:'gallery',id:galleryId,alt:'De galería',credit:''}]));
  await saveOutingEditor(tx,id,photoForm,options);
  const selected=await tx`select id,alt,position from outing_photos where outing_id=${id} and position is not null order by position`;
  assert.equal(selected.length,2);assert.equal(selected[0].id,second);assert.equal(selected[0].alt,'Nueva portada');assert.notEqual(selected[1].id,galleryId);
  await tx`insert into request_outing_photos(request_id,position,alt,credit,thumbnail,display_image)values(${request},1,'General','',${Buffer.from('d')},${Buffer.from('d')})`;
  await tx`update requests set outing_photos_initialized=true where id=${request}`;
  const inherit=await form();inherit.set('starts','2027-01-09');inherit.set('registrationDeadline','2027-01-09');inherit.set('photoMode','inherit');
  await saveOutingEditor(tx,id,inherit,options);
  assert.equal((await tx`select alt from outing_photos where outing_id=${id} and position=1`)[0].alt,'General');
  assert.equal((await tx`select outing_overrides from outings where id=${id}`)[0].outing_overrides.includes('photos'),false);
  const shared=await form();shared.set('starts','2027-01-09');shared.set('registrationDeadline','2027-01-09');shared.set('editRequest','1');shared.set('request-organization','Nueva organización');shared.set('request-activity','Actividad');
  await assert.rejects(()=>saveOutingEditor(tx,id,shared,options),e=>e.target==='confirmShared');
  assert.equal((await tx`select organization from requests where id=${request}`)[0].organization,'DEMO prueba editor');
  const forbidden=await form();await assert.rejects(()=>saveOutingEditor(tx,id,forbidden,{...options,canOperate:()=>false}),e=>e.target==='form');
  assert.equal((await tx`select count(*)::int as count from registration_mail_outbox where registration_id in(select id from registrations where outing_id=${id})`)[0].count,0);
  throw rollback;
 });
}catch(error){if(error!==rollback)throw error;console.log('OK: guardado conjunto, fechas/cierre simultáneos, motivo de cupos, concurrencia, permisos y fallo de foto sin cambios parciales.');}
finally{await sql.end();}
