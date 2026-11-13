'use server';
import {staff,canOperate} from '../../../../lib/auth';
import {sql} from '../../../../lib/db';
import {uuid,outingIsEditable} from '../../../../lib/registration';
import {OutingEditError,saveOutingEditor} from '../../../../lib/outing-editor';
import {preparePhoto,graphPhotoStore} from '../../../../lib/outing-photos';
import {withPhotoUploads,PhotoUploadError} from '../../../../lib/photo-upload-workflow';
import {dispatchRegistrationUpdates} from '../../../../lib/registration-workflow';
import {revalidatePath} from 'next/cache';
import type {FormResult} from '../../../../lib/form-result';
export async function saveOutingEdit(id:string,form:FormData):Promise<FormResult>{
 const principal=await staff();if(!principal||!uuid(id))return {error:'No tenés permiso para editar la salida.'};
 try{
  const files=(form.get('photoMode')==='inherit'?[]:[...form]).filter((entry):entry is [string,File]=>entry[0].startsWith('photo-new-')&&entry[1] instanceof File).map(([key,file])=>({key:key.slice(6),file}));
  await withPhotoUploads({sql,principal,scope:`editor:${id}`,form,files,store:graphPhotoStore(),prepare:preparePhoto,
   authorize:async(tx,user)=>{const [o]=await tx`select unit,status from outings where id=${id}`;if(!o||!canOperate(user,o.unit))throw new OutingEditError('form','No tenés permiso para editar esta salida.');if(!outingIsEditable(o.status))throw new OutingEditError('form','Esta convocatoria está cerrada para edición.');},
   validate:async(tx,user)=>{await saveOutingEditor(tx,id,form,{actor:user.subject,canOperate:unit=>canOperate(user,unit),preflightOnly:true});return null;},
   commit:async(tx,user,uploads)=>{await saveOutingEditor(tx,id,form,{actor:user.subject,canOperate:unit=>canOperate(user,unit),uploads});return {saved:true};},
  });
 }catch(error){if(error instanceof PhotoUploadError)return {fieldErrors:error.fieldErrors};if(error instanceof OutingEditError)return error.fieldErrors?{fieldErrors:error.fieldErrors}:error.target==='form'?{error:error.message}:{fieldErrors:{[error.target]:error.message}};return {error:'No se pudo guardar. Tus cambios y archivos se conservan para reintentar.'};}
 await dispatchRegistrationUpdates();revalidatePath(`/coordinacion/salidas/${id}`);revalidatePath(`/convocatorias/${id}`);revalidatePath('/');return {saved:true};
}
