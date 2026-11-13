import {createHash,randomUUID} from 'node:crypto';
import type postgres from 'postgres';
import type {Transaction} from './registration';
import type {StaffPrincipal} from './authorization';
export type PreparedPhoto={original:ArrayBuffer;format:string;thumbnail:Buffer;display:Buffer};
export type PhotoReference={drive:string|null;item:string|null;thumbnail:Buffer;display:Buffer};
export type PhotoTarget={drive:string;folder:string;name:string};
export type PhotoStore={target:()=>Omit<PhotoTarget,'name'>|null;put:(photo:PreparedPhoto,target:PhotoTarget)=>Promise<{drive:string;item:string}>;
 find:(target:PhotoTarget)=>Promise<{item:string;etag:string}|null>;remove:(target:PhotoTarget,item:string,etag:string)=>Promise<void>};
export class PhotoUploadError extends Error{
 fieldErrors:Record<string,string>;
 constructor(key:string,message:string){super(message);this.fieldErrors={[`${key}-photo`]:message};}
}
export async function currentPhotoPrincipal(tx:Transaction,principal:NonNullable<StaffPrincipal>){
 const grants=await tx<{role:string;unit:string}[]>`select role,unit from grants where subject=${principal.subject} for share`;
 return {subject:principal.subject,grants};
}
const hash=(text:string|Uint8Array)=>createHash('sha256').update(text).digest('hex');
export function photoOperationKey(actor:string,scope:string,form:FormData,prepared:Map<string,PreparedPhoto>){
 const entries=[...form].filter(([key,value])=>typeof value==='string'&&!key.startsWith('$ACTION_')).map(([key,value])=>[key,value]);
 // Preserve intentional repeat order (periods/photos), and bind every image's actual bytes.
 const files=[...prepared].map(([key,image])=>[key,hash(new Uint8Array(image.original))]);
 return hash(JSON.stringify([actor,scope,form.get('photoOperation')||randomUUID(),entries,files]));
}
/** Only ledger-created originals can be compensated; existing/gallery/inherited files never enter here. */
export async function cleanupPhotoOrphans(sql:postgres.Sql,store:PhotoStore,filter?:{operation:string;attempt:string}){
 // Recover abandoned processes. No provider calls occur while this transaction holds locks.
 await sql.begin(async tx=>{
  const expired=await tx`update photo_upload_operations set state='failed' where state='uploading' and lease_until<clock_timestamp() returning id,attempt`;
  for(const op of expired)await tx`update photo_upload_items set state='cleanup',retry_at=clock_timestamp()+interval '15 minutes' where operation_id=${op.id} and attempt=${op.attempt} and state in ('planned','uploaded')`;
 });
 const rows=await sql`select id from photo_upload_items where state in ('cleanup','cleaning') and retry_at<=clock_timestamp()
   ${filter?sql`and operation_id=${filter.operation} and attempt=${filter.attempt}`:sql``} order by created_at,id limit 30`;
 let deleted=0,pending=0,protectedCount=0;
 for(const row of rows){
  const item=await sql.begin(async tx=>{
   const [entry]=await tx`select * from photo_upload_items where id=${row.id} and state in ('cleanup','cleaning') and retry_at<=clock_timestamp() for update skip locked`;
   if(!entry)return;
   const [references]=await tx`select exists(select 1 from outing_photos where original_drive=${entry.drive} and original_item=${entry.item})
    or exists(select 1 from request_outing_photos where original_drive=${entry.drive} and original_item=${entry.item}) as used`;
   const [staging]=await tx`select to_regclass('historical_import_photos') as name`;
   const historical=staging.name?(await tx`select 1 from historical_import_photos where original_drive=${entry.drive} and original_item=${entry.item} limit 1`).length>0:false;
   if(references.used||historical){await tx`update photo_upload_items set state='protected' where id=${entry.id}`;protectedCount++;return;}
   await tx`update photo_upload_items set state='cleaning',cleanup_attempts=cleanup_attempts+1,retry_at=clock_timestamp()+interval '5 minutes' where id=${entry.id}`;
   return entry;
  });
  if(!item)continue;
  const target={drive:String(item.drive),folder:String(item.folder),name:String(item.name)};
  try{
   const found=await store.find(target);
   if(!found){
    // A timed-out PUT can complete late. Keep its unique path tracked until positively resolved.
    if(item.uncertain){await sql`update photo_upload_items set state='cleanup',retry_at=clock_timestamp()+interval '15 minutes' where id=${item.id}`;pending++;continue;}
   }else{
    if(item.item&&found.item!==item.item)throw Error('La referencia externa cambió.');
    const safe=await sql.begin(async tx=>{
     await tx`select id from photo_upload_items where id=${item.id} for update`;
     await tx`update photo_upload_items set item=${found.item},uncertain=false where id=${item.id}`;
     const [refs]=await tx`select exists(select 1 from outing_photos where original_drive=${item.drive} and original_item=${found.item}) or exists(select 1 from request_outing_photos where original_drive=${item.drive} and original_item=${found.item}) as used`;
     const [staging]=await tx`select to_regclass('historical_import_photos') as name`;
     const historical=staging.name?(await tx`select 1 from historical_import_photos where original_drive=${item.drive} and original_item=${found.item} limit 1`).length>0:false;
     if(refs.used||historical){await tx`update photo_upload_items set state='protected' where id=${item.id}`;return false;}
     return true;
    });
    if(!safe){protectedCount++;continue;}
    await store.remove(target,found.item,found.etag);
   }
   await sql`update photo_upload_items set state='deleted' where id=${item.id}`;deleted++;
  }catch{
   await sql`update photo_upload_items set state='cleanup',retry_at=clock_timestamp()+interval '5 minutes' where id=${item.id}`;pending++;
  }
 }
 return {deleted,pending,protected:protectedCount};
}
/** IO orchestration: authorization -> bytes -> validation -> provider -> short, fully revalidated commit. */
export async function withPhotoUploads<T extends object>(options:{sql:postgres.Sql;principal:NonNullable<StaffPrincipal>;scope:string;form:FormData;
 files:{key:string;file:File}[];store:PhotoStore;prepare:(file:File)=>Promise<PreparedPhoto>;
 authorize:(tx:Transaction,user:NonNullable<StaffPrincipal>)=>Promise<void>;
 validate:(tx:Transaction,user:NonNullable<StaffPrincipal>)=>Promise<unknown>;
 commit:(tx:Transaction,user:NonNullable<StaffPrincipal>,uploads:Map<string,PhotoReference>,snapshot:unknown)=>Promise<T>}){
 const {sql,principal,store}=options;
 // This callback must load only authorization metadata, never image bytes.
 await sql.begin(async tx=>options.authorize(tx,await currentPhotoPrincipal(tx,principal)));
 const prepared=new Map<string,PreparedPhoto>(),errors:Record<string,string>={};
 for(const input of options.files)try{prepared.set(input.key,await options.prepare(input.file));}catch{errors[`${input.key}-photo`]='El archivo no es una imagen válida de hasta 3 MB y 24 megapíxeles.';}
 if(Object.keys(errors).length){const error=new PhotoUploadError('photos','Revisá las fotos indicadas.');error.fieldErrors=errors;throw error;}
 const fingerprint=photoOperationKey(principal.subject,options.scope,options.form,prepared),nonce=options.form.get('photoOperation');
 const operation=typeof nonce==='string'&&nonce?hash(JSON.stringify([principal.subject,options.scope,nonce])):fingerprint,attempt=randomUUID();
 const [previous]=await sql`select result,fingerprint from photo_upload_operations where id=${operation} and state='committed' and actor=${principal.subject}`;
 if(previous){if(previous.fingerprint!==fingerprint)throw Error('Esta operación ya se guardó con otros datos. Actualizá la página.');return previous.result as T;}
 const snapshot=await sql.begin(async tx=>options.validate(tx,await currentPhotoPrincipal(tx,principal)));
 const acquired=await sql.begin(async tx=>{
  await tx`insert into photo_upload_operations(id,actor,scope,fingerprint,state,attempt,lease_until) values(${operation},${principal.subject},${options.scope},${fingerprint},'uploading',${attempt},clock_timestamp()+interval '10 minutes') on conflict do nothing`;
  const [op]=await tx`select *,lease_until>clock_timestamp() as live from photo_upload_operations where id=${operation} for update`;
  if(op.state==='committed'){if(op.fingerprint!==fingerprint)throw Error('Esta operación ya se guardó con otros datos. Actualizá la página.');return {result:op.result};}
  if(op.state==='uploading'&&op.attempt!==attempt&&op.live)throw Error('Esta carga todavía está en proceso. Esperá antes de reintentar.');
  if(op.attempt!==attempt)await tx`update photo_upload_items set state='cleanup',retry_at=clock_timestamp()+interval '15 minutes' where operation_id=${operation} and attempt=${op.attempt} and state in ('planned','uploaded')`;
  await tx`update photo_upload_operations set state='uploading',fingerprint=${fingerprint},attempt=${attempt},lease_until=clock_timestamp()+interval '10 minutes' where id=${operation}`;
  return {};
 });
 if('result' in acquired)return acquired.result as T;
 const uploads=new Map<string,PhotoReference>();
 try{
  const destination=prepared.size?store.target():null;
  for(const[key,image]of prepared){
   if(!destination){uploads.set(key,{drive:null,item:null,thumbnail:image.thumbnail,display:image.display});continue;}
   const id=randomUUID(),target={...destination,name:`${id}.${image.format}`};
   await sql`insert into photo_upload_items(id,operation_id,attempt,photo_key,drive,folder,name,state)values(${id},${operation},${attempt},${key},${target.drive},${target.folder},${target.name},'planned')`;
   let original;
   try{original=await store.put(image,target);}catch{throw new PhotoUploadError(key,'No se pudo guardar esta foto en SharePoint. El archivo y sus datos se conservan para reintentar.');}
   await sql`update photo_upload_items set item=${original.item},state=case when state='planned' then 'uploaded' else state end,uncertain=false where id=${id}`;
   uploads.set(key,{...original,thumbnail:image.thumbnail,display:image.display});
  }
  const saved=await sql.begin(async tx=>{
   const [op]=await tx`select *,lease_until>clock_timestamp() as live from photo_upload_operations where id=${operation} for update`;
   if(op.state!=='uploading'||op.attempt!==attempt||!op.live)throw Error('La carga cambió o venció. Tus datos se conservan para reintentar.');
   const user=await currentPhotoPrincipal(tx,principal);
   await options.authorize(tx,user);
   const result=await options.commit(tx,user,uploads,snapshot);
   // Only confirmed references become attached; ignored/superseded files remain compensable.
   await tx`update photo_upload_items i set state=case when
    exists(select 1 from outing_photos p where p.original_drive=i.drive and p.original_item=i.item)
    or exists(select 1 from request_outing_photos p where p.original_drive=i.drive and p.original_item=i.item)
    then 'attached' else 'cleanup' end where operation_id=${operation} and attempt=${attempt} and state='uploaded'`;
   await tx`update photo_upload_operations set state='committed',result=${tx.json(result)} where id=${operation}`;
   return result;
  });
  try{await cleanupPhotoOrphans(sql,store,{operation,attempt});}catch{console.error('[photo-cleanup] Compensación pendiente en el registro de cargas.');}
  return saved;
 }catch(error){
  try{
   const committed=await sql.begin(async tx=>{
    const [op]=await tx`select * from photo_upload_operations where id=${operation} for update`;
    if(op.state==='committed'&&op.fingerprint===fingerprint)return op.result;
    if(op.attempt===attempt){await tx`update photo_upload_operations set state='failed' where id=${operation}`;
     await tx`update photo_upload_items set state='cleanup',retry_at=case when uncertain then clock_timestamp()+interval '15 minutes' else clock_timestamp() end where operation_id=${operation} and attempt=${attempt} and state in ('planned','uploaded')`;}
   });
   if(committed)return committed as T; // A lost COMMIT acknowledgement must never trigger deletion.
   await cleanupPhotoOrphans(sql,store,{operation,attempt});
  }catch{console.error('[photo-cleanup] Compensación pendiente en el registro de cargas.');}
  throw error;
 }
}
