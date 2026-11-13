import {parsePhotoMetadata,type EditorPhoto} from './photo-metadata';
export type {EditorPhoto} from './photo-metadata';
import {validateOutingEdit} from './outing-form-validation';
import type {FieldErrors} from './form-result';
import type { Transaction } from './registration';
import { audit,date,field,outingIsEditable,uuid } from './registration';
import { commonOutingFields,supportRequestFields } from './collection-fields';
import { outingLogisticsFields } from './outing-logistics';
async function outingUnitHasConflict(tx:Transaction,ids:string[],unit:string){
 const [conflict]=await tx`select 1 from registrations r left join volunteers v on v.id=r.volunteer_id where r.outing_id=any(${ids}::uuid[]) and r.status in ('validación','revisión','espera','confirmada') and (v.id is null or not (${unit}=any(v.units))) limit 1`;
 return !!conflict;
}
import { occupiedSeats,promoteWaitlist } from './registration-workflow';
import { inheritGeneralPhotos } from './outing-inheritance';

export class OutingEditError extends Error { target:string; fieldErrors?:FieldErrors; constructor(target:string,message:string,fieldErrors?:FieldErrors){super(message);this.target=target;this.fieldErrors=fieldErrors;} }
const invalid=(target:string,message:string):never=>{throw new OutingEditError(target,message);};
export async function outingEditVersion(tx:Transaction | import('postgres').Sql,id:string){
 const [row]=await tx`select md5(to_jsonb(o)::text || to_jsonb(r)::text || coalesce((select jsonb_agg(jsonb_build_array(p.id,p.position,p.alt,p.credit) order by p.position)::text from outing_photos p where p.outing_id=o.id and p.position is not null),'[]')) as version from outings o join requests r on r.id=o.request_id where o.id=${id}`;
 return String(row?.version || '');
}

export async function saveOutingEditor(tx:Transaction,id:string,form:FormData,options:{photoErrors?:FieldErrors;actor:string;canOperate:(unit:string)=>boolean;upload:(key:string)=>Promise<{item:string|null;drive:string|null;thumbnail:Buffer;display:Buffer}>}){
 const [ref]=await tx`select request_id from outings where id=${id}`;
 if(!ref)invalid('form','La convocatoria no está disponible.');
 const [request]=await tx`select * from requests where id=${ref.request_id} for update`;
 const [outing]=await tx`select *,starts::text as first_day,ends::text as last_day from outings where id=${id} for update`;
 if(!outing||!options.canOperate(outing.unit))invalid('form','No tenés permiso para editar esta salida.');
 if(!outingIsEditable(outing.status))invalid('form','Esta convocatoria está cerrada para edición.');
 if(field(form,'version')!==await outingEditVersion(tx,id))invalid('form','La salida cambió desde que abriste el editor. Recargá la página antes de guardar.');
 const [membership]=await tx`select exists(select 1 from outings where request_id=${outing.request_id} and id<>${id}) as is_series`;
 const isSeries=membership.is_series;
 const usedForValidation=await occupiedSeats(tx,id);
 const errors={...validateOutingEdit(form,{starts:outing.first_day,ends:outing.last_day,mode:outing.flexible?'flexible':'fija',capacity:String(outing.capacity)},request.outing_defaults??outing,isSeries,usedForValidation,request,isSeries),...options.photoErrors};
 if(Object.keys(errors).length)throw new OutingEditError('form','',errors);
 const personal=new Set(isSeries?form.getAll('personal').map(String):commonOutingFields.map(item=>item.name));
 const defaults=request.outing_defaults??outing;
 const updates:Record<string,string|number|boolean|null>={};
 for(const item of commonOutingFields){
  const value=personal.has(item.name)?field(form,item.name):String(defaults[item.name]??'');
  if(item.required&&!value.trim())invalid(item.name,'Completá este campo.');
  if(value.length>(item.multiline?5000:240))invalid(item.name,'El texto supera la longitud permitida.');
  updates[item.name]=value;
 }
 const unit=String(updates.unit);
 if(!options.canOperate(unit))invalid('form','No tenés permiso para gestionar la unidad seleccionada.');
 if(!(await tx`select 1 from units where name=${unit}`).length)invalid('unit','Seleccioná una unidad disponible.');
 if(unit!==outing.unit&&unit!=='Voluntariado General'&&await outingUnitHasConflict(tx,[id],unit))invalid('form','Hay inscripciones incompatibles con esta unidad. Revisalas antes de cambiarla.');
 for(const item of outingLogisticsFields){const value=field(form,item.name);if(value.length>5000)invalid(item.name,'Usá hasta 5000 caracteres.');updates[item.name]=value;}
 const starts=field(form,'starts'),ends=field(form,'ends'),mode=field(form,'mode');
 if(!date(starts))invalid('starts','Elegí una fecha de inicio válida.');
 if(!date(ends)||starts>ends)invalid('ends','El fin debe ser igual o posterior al inicio.');
 if(!['fija','flexible'].includes(mode))invalid('mode','Elegí la modalidad.');
 const dateChanged=starts!==outing.first_day||ends!==outing.last_day||(mode==='flexible')!==outing.flexible;
 if(dateChanged){
  if(!field(form,'dateReason'))invalid('dateReason','Indicá el motivo del cambio de fechas o modalidad.');
  const [conflict]=await tx`select 1 from registrations where outing_id=${id} and status in ('validación','revisión','espera','confirmada') and (starts<${starts}::date or ends>${ends}::date or (not ${mode==='flexible'} and (starts<>${starts}::date or ends<>${ends}::date))) limit 1`;
  if(conflict)invalid('form','Hay inscripciones con fechas incompatibles. Revisalas antes de cambiar el periodo.');
 }
 const capacity=Number(field(form,'capacity')),used=await occupiedSeats(tx,id);
 if(!Number.isSafeInteger(capacity)||capacity<Math.max(1,used)||capacity>10000)invalid('capacity',`Ingresá un cupo entre ${Math.max(1,used)} y 10 000.`);
 const capacityChanged=capacity!==outing.capacity;
 if(capacityChanged&&!field(form,'capacityReason'))invalid('capacityReason','Indicá el motivo del ajuste de cupos.');
 const visibility=field(form,'visibility'),deadline=field(form,'registrationDeadline');
 if(!['publica','privada'].includes(visibility))invalid('visibility','Elegí la visibilidad.');
 if(!date(deadline)||deadline>starts)invalid('registrationDeadline','El cierre debe ser el mismo día del inicio o anterior.');
 const shared=Object.fromEntries(supportRequestFields.map(item=>[item.name,field(form,`request-${item.name}`)]));
 const requestChanged=form.has('editRequest')&&supportRequestFields.some(item=>shared[item.name]!==String(request[item.name]??'').trim());
 if(requestChanged){
  if(!shared.organization||!shared.activity)invalid('request-organization','Completá organización y actividad.');
  for(const item of supportRequestFields)if(shared[item.name].length>5000)invalid(`request-${item.name}`,'Usá hasta 5000 caracteres.');
  const blocks=await tx`select unit from outings where request_id=${outing.request_id}`;
  if(blocks.some(block=>!options.canOperate(block.unit)))invalid('form','Necesitás gestionar todos los bloques para editar los datos comunes.');
  if(blocks.length>1&&field(form,'confirmShared')!=='on')invalid('confirmShared','Confirmá el cambio para todos los bloques.');
 }
 const photoMode=field(form,'photoMode');
 let photos:EditorPhoto[]=[];
 if(!['keep','personal','inherit'].includes(photoMode)||(!isSeries&&photoMode==='inherit'))invalid('photos','Revisá la selección de fotos.');
 if(photoMode==='personal'){
  const parsed=parsePhotoMetadata(field(form,'photos'));
  if(Object.keys(parsed.fieldErrors).length)throw new OutingEditError('form','',parsed.fieldErrors);
  photos=parsed.photos;
  if(!Array.isArray(photos)||photos.length>6||new Set(photos.map(p=>p.key)).size!==photos.length)invalid('photos','Elegí hasta seis fotos sin repetir.');
  if(outing.status==='abierta'&&!photos.length)invalid('photos','La convocatoria abierta necesita una portada.');
  const ids=new Set<string>();
  for(const photo of photos){
   if(typeof photo.alt!=='string'||!photo.alt.trim()||photo.alt.length>240||typeof photo.credit!=='string'||photo.credit.length>150)invalid('photos','Completá la descripción y revisá el crédito de las fotos.');
   if(photo.kind==='upload'){if(!/^new-[\w-]+$/.test(photo.key))invalid('photos','Archivo inválido.');}
   else{
    if(!photo.id||!uuid(photo.id!)||ids.has(photo.id!))invalid('photos','La foto no es válida o está repetida.');ids.add(photo.id!);
    const [source]=await tx`select o.unit,p.outing_id from outing_photos p join outings o on o.id=p.outing_id where p.id=${photo.id!} and p.position is not null for share of p,o`;
    if(!source||!options.canOperate(source.unit)||(photo.kind==='existing'&&source.outing_id!==id)||!['existing','gallery'].includes(photo.kind))invalid('form','Una foto ya no está disponible o no tenés permiso para usarla.');
   }
  }
 }
 if(photoMode==='inherit'&&(!request.outing_photos_initialized||(outing.status==='abierta'&&!(await tx`select 1 from request_outing_photos where request_id=${outing.request_id}`).length)))invalid('photos','La convocatoria general no tiene una portada disponible.');
 // Validate every section before uploading or changing any database record.
 const uploads=new Map<string,Awaited<ReturnType<typeof options.upload>>>();
 for(const p of photos.filter(p=>p.kind==='upload'))uploads.set(p.key,await options.upload(p.key));
 const overrides=[...outing.outing_overrides.filter((name:string)=>!commonOutingFields.some(item=>item.name===name)),...commonOutingFields.filter(item=>personal.has(item.name)).map(item=>item.name)];
 await tx`update outings set ${tx({...updates,starts,ends,flexible:mode==='flexible',capacity,listed:visibility==='publica',registration_deadline:deadline})},outing_overrides=${overrides} where id=${id}`;
 if(requestChanged){await tx`update requests set ${tx(shared)} where id=${outing.request_id}`;await audit(tx,options.actor,'Actualizó solicitud de apoyo',outing.request_id);}
 if(photoMode==='inherit'){await inheritGeneralPhotos(tx,outing.request_id,id);await tx`update outings set outing_overrides=array_remove(outing_overrides,'photos') where id=${id}`;}
 if(photoMode==='personal'){
  await tx`update outing_photos set position=null where outing_id=${id} and position is not null`;
  for(const [i,p]of photos.entries()){
   if(p.kind==='existing')await tx`update outing_photos set position=${i+1},alt=${p.alt},credit=${p.credit} where id=${p.id!} and outing_id=${id}`;
   else if(p.kind==='gallery')await tx`insert into outing_photos(outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image) select ${id},${i+1},${p.alt},${p.credit},original_item,original_drive,thumbnail,display_image from outing_photos where id=${p.id!}`;
   else{const u=uploads.get(p.key)!;await tx`insert into outing_photos(outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image) values(${id},${i+1},${p.alt},${p.credit},${u.item},${u.drive},${u.thumbnail},${u.display})`;}
  }
  if(!overrides.includes('photos'))await tx`update outings set outing_overrides=array_append(outing_overrides,'photos') where id=${id}`;
 }
 await audit(tx,options.actor,'Editó convocatoria de salida',id);
 if(dateChanged)await audit(tx,options.actor,'Cambió fechas o modalidad',id,`${outing.first_day} a ${outing.last_day} → ${starts} a ${ends} (${mode}). ${field(form,'dateReason')}`);
 if(capacityChanged){await audit(tx,options.actor,'Cambió cupo',id,`${outing.capacity} → ${capacity}. ${field(form,'capacityReason')}`);await promoteWaitlist(tx,id,options.actor);}
}

export async function outingSeriesVersion(tx:Transaction | import('postgres').Sql,id:string){
 const [row]=await tx`select md5(to_jsonb(r)::text||coalesce((select jsonb_agg(to_jsonb(o) order by o.id)::text from outings o where o.request_id=r.id),'[]')||coalesce((select jsonb_agg(jsonb_build_array(p.id,p.position,p.alt,p.credit) order by p.id)::text from outing_photos p join outings o on o.id=p.outing_id where o.request_id=r.id and p.position is not null),'[]')) as version from requests r where r.id=${id}`;
 return String(row?.version||'');
}
