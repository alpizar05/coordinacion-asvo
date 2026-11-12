'use server';
import {staff,canOperate} from '../../../../lib/auth';
import {sql} from '../../../../lib/db';
import {uuid} from '../../../../lib/registration';
import {OutingEditError,saveOutingEditor} from '../../../../lib/outing-editor';
import {preparePhoto,storeOriginal} from '../../../../lib/outing-photos';
import {dispatchRegistrationUpdates} from '../../../../lib/registration-workflow';
import {revalidatePath} from 'next/cache';
import type {FormResult,FieldErrors} from '../../../../lib/form-result';
export async function saveOutingEdit(id:string,form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!uuid(id))return {error:'No tenés permiso para editar la salida.'};
 try{
  const prepared=new Map<string,Awaited<ReturnType<typeof preparePhoto>>>(),photoErrors:FieldErrors={};let bytes=0;
  for(const[key,value]of form.entries())if(key.startsWith('photo-new-')&&value instanceof File){bytes+=value.size;try{prepared.set(key.slice(6),await preparePhoto(value));}catch{photoErrors[`${key.slice(6)}-photo`]='El archivo no es una imagen válida de hasta 3 MB y 24 megapíxeles.';}}
  if(bytes>3.75*1024*1024)photoErrors.photos='Las fotos nuevas deben pesar hasta 3,75 MB en conjunto.';
  await sql.begin(tx=>saveOutingEditor(tx,id,form,{actor:user.subject,photoErrors,canOperate:unit=>canOperate(user,unit),upload:async key=>{
   const image=prepared.get(key);if(!image)throw new OutingEditError('form','No se encontró un archivo preparado.');
   try{const original=await storeOriginal(image);return {...original,thumbnail:image.thumbnail,display:image.display};}
   catch{throw new OutingEditError('form','No se pudo guardar una foto en SharePoint. Los archivos y metadatos se conservan para reintentar.');}
  }}));
 }catch(error){if(error instanceof OutingEditError)return error.fieldErrors?{fieldErrors:error.fieldErrors}:error.target==='form'?{error:error.message}:{fieldErrors:{[error.target]:error.message}};return {error:'No se pudo guardar. Tus cambios se conservan para reintentar.'};}
 await dispatchRegistrationUpdates();revalidatePath(`/coordinacion/salidas/${id}`);revalidatePath(`/convocatorias/${id}`);revalidatePath('/');return {saved:true};
}
