import {allows,type StaffPrincipal} from './authorization';
import {requireStaff} from './auth';
import {field,uuid,audit,outingIsEditable,digest,type Transaction} from './registration';
import {outingEditVersion} from './outing-editor';
import {validatePhoto} from './outing-form-validation';
import {outingPhotoLimit} from './outing-photo-limits';
import type {PhotoReference} from './photo-upload-workflow';
export async function authorizePhotoMutation(tx:Transaction,id:string,user:NonNullable<StaffPrincipal>){
 const [outing]=await tx`select unit,status from outings where id=${id}`;
 requireStaff(user,!!outing&&allows(user,'photos.manage',{unit:outing.unit}));
 if(!outingIsEditable(outing.status))throw Error('Esta convocatoria está cerrada para edición.');
}
export async function photoMutationVersion(tx:Transaction,id:string,photoId:string,action:string){
 const version=await outingEditVersion(tx,id);
 const source=action==='galeria'&&uuid(photoId)?await tx`select p.id,p.position,p.alt,p.credit,p.original_drive,p.original_item,o.unit from outing_photos p join outings o on o.id=p.outing_id where p.id=${photoId}`:[];
 return digest(JSON.stringify([version,source]));
}
export async function savePhotoMutation(tx:Transaction,id:string,form:FormData,user:NonNullable<StaffPrincipal>,options:{preflightOnly?:boolean;expectedVersion?:string;prepared?:PhotoReference}={}){
 const action=field(form,'action'),photoId=field(form,'photoId'),alt=field(form,'alt'),credit=field(form,'credit'),prepared=options.prepared;
 if(!['agregar','galeria','editar','retirar','portada','subir','bajar'].includes(action))throw Error('La acción de foto no está disponible.');
 if(['agregar','editar'].includes(action)){
  const errors=validatePhoto(form,{mode:action==='agregar'?'upload':'edit'});if(Object.keys(errors).length){const error=Error('Revisá los datos de la foto.') as Error&{fieldErrors:typeof errors};error.fieldErrors=errors;throw error;}
 }
 if(action==='galeria'&&(form.has('alt')&&(!alt||alt.length>240)||credit.length>150))throw Error('Elegí una descripción válida y revisá el crédito de la foto.');
      const [outing] = await tx`select unit,status from outings where id=${id} for update`;
      requireStaff(user,!!outing && allows(user,'photos.manage',{unit:outing.unit}));
      if (!outingIsEditable(outing.status)) {
        throw Error('Esta convocatoria está cerrada para edición.');
      }
      const markPersonal = () => tx`update outings set outing_overrides=array_append(outing_overrides,'photos')
        where id=${id} and not ('photos'=any(outing_overrides))`;
      const photos = await tx`select id,position from outing_photos where outing_id=${id} and position is not null order by position`;
      if ((action==='agregar' || action === 'galeria') && photos.length >= outingPhotoLimit) {
        throw new Error('La convocatoria admite hasta seis fotos.');
      }
      const currentVersion=await photoMutationVersion(tx,id,photoId,action);
      if(options.expectedVersion&&options.expectedVersion!==currentVersion)throw Error('La convocatoria o sus fotos cambiaron. Actualizá antes de guardar.');
      if (action === 'galeria') {
        if (!uuid(photoId)) throw new Error('Elegí una foto disponible de la galería.');
        const [source] = await tx`select p.id,o.unit
          from outing_photos p join outings o on o.id=p.outing_id
          where p.id=${photoId} and p.position is not null and p.outing_id<>${id}
          for share of p,o`;
        if (!source || !allows(user,'photos.manage',{unit:source.unit})) throw new Error('Elegí una foto disponible de la galería.');
        const sourceVersion=await photoMutationVersion(tx,id,photoId,action);if(options.expectedVersion&&options.expectedVersion!==sourceVersion)throw Error('La foto de origen cambió. Actualizá antes de guardar.');
        if(options.preflightOnly)return sourceVersion;
        const [photo] = await tx`insert into outing_photos
          (outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
          select ${id},${photos.length + 1},coalesce(${form.has('alt') ? alt : null}::text,alt),coalesce(${form.has('credit') ? credit : null}::text,credit),original_item,original_drive,thumbnail,display_image
          from outing_photos where id=${source.id} returning id`;
        await markPersonal();
        await audit(tx, user.subject, 'Adjuntó foto de la galería', photo.id);
        return;
      }
      if (action==='agregar') {
        if(options.preflightOnly)return currentVersion;
        if(!prepared)throw Error('No se encontró un archivo preparado.');
        const original=prepared;
        const [photo] = await tx`insert into outing_photos(outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
          values (${id},${photos.length + 1},${alt},${credit},${original.item},${original.drive},
            ${prepared.thumbnail},${prepared.display}) returning id`;
        await markPersonal();
        await audit(tx,user.subject,'Adjuntó foto',photo.id);
        return;
      }
      const index = photos.findIndex(photo => photo.id === photoId);
      if (index < 0) throw new Error('Elegí una foto que siga disponible en la convocatoria.');
      if(options.preflightOnly){if(action==='retirar'&&outing.status==='abierta'&&photos.length===1)throw Error('Agregá otra foto antes de retirar la única portada.');return currentVersion;}
      if (action === 'editar') {
        await tx`update outing_photos set alt=${alt},credit=${credit} where id=${photoId} and outing_id=${id}`;
        await markPersonal();
        await audit(tx,user.subject,'Actualizó descripción y crédito de foto',photoId);
        return;
      }
      if (action === 'retirar') {
        if (outing.status === 'abierta' && photos.length === 1) throw new Error('Agregá otra foto antes de retirar la única portada.');
        await tx`update outing_photos set position=null where id=${photoId}`;
        await tx`update outing_photos set position=position-1 where outing_id=${id} and position>${index+1}`;
        await markPersonal();
        await audit(tx,user.subject,'Retiró foto',photoId);
        return;
      }
      const target = photos[action === 'portada' ? 0 : action === 'subir' ? index-1 : action === 'bajar' ? index+1 : -1];
      if (!target || target.id === photoId) return;
      await tx`update outing_photos set position=case when id=${photoId} then ${target.position}::smallint else ${index+1}::smallint end
        where id in (${photoId},${target.id})`;
      await markPersonal();
      await audit(tx,user.subject,'Reordenó foto',photoId);
}
