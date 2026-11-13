'use server';
import type {FormResult} from '../lib/form-result';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {staff} from '../lib/auth';
import {sql} from '../lib/db';
import {field,uuid} from '../lib/registration';
import {preparePhoto,graphPhotoStore} from '../lib/outing-photos';
import {PhotoUploadError,withPhotoUploads} from '../lib/photo-upload-workflow';
import {authorizePhotoMutation,savePhotoMutation} from '../lib/photo-mutation';
export async function managePhoto(id:string,form:FormData){
 const result=await mutatePhoto(id,form),back=`/coordinacion/salidas/${id}`;
 const error=result.saved?'':result.error||'Revisá los datos de la foto.';
 redirect(error?`${back}?editar=1&error=${encodeURIComponent(error)}#fotos`:`${back}?editar=1&confirmacion=foto#fotos`);
}
export async function attachOutingPhoto(id:string,form:FormData):Promise<FormResult>{
 if(!['agregar','galeria','editar'].includes(field(form,'action')))return {error:'Elegí cómo agregar la foto.'};
 return mutatePhoto(id,form);
}
async function mutatePhoto(id:string,form:FormData):Promise<FormResult>{
 const principal=await staff();if(!principal||!uuid(id))return {error:'No tenés permiso para gestionar esta convocatoria.'};
 const file=form.get('photo'),files=field(form,'action')==='agregar'&&file instanceof File?[{key:'upload',file}]:[];
 try{
  await withPhotoUploads({sql,principal,scope:`photo:${id}`,form,files,prepare:preparePhoto,store:graphPhotoStore(),
   authorize:(tx,user)=>authorizePhotoMutation(tx,id,user),
   validate:(tx,user)=>savePhotoMutation(tx,id,form,user,{preflightOnly:true}),
   commit:async(tx,user,uploads,snapshot)=>{await savePhotoMutation(tx,id,form,user,{expectedVersion:String(snapshot),prepared:uploads.get('upload')});return {saved:true};},
  });
 }catch(error){
  if(error instanceof PhotoUploadError)return {fieldErrors:{photo:Object.values(error.fieldErrors)[0]}};
  if(error&&typeof error==='object'&&'fieldErrors'in error)return {fieldErrors:error.fieldErrors as Record<string,string>};
  const message=error instanceof Error?error.message:'';return {error:/^(Elegí|Usá|La convocatoria|Configurá|No se pudo|SharePoint|Agregá|Esta convocatoria|Acceso denegado)/.test(message)?message:'No se pudo procesar la foto. Tus datos se conservan para reintentar.'};
 }
 revalidatePath(`/coordinacion/salidas/${id}`);revalidatePath(`/convocatorias/${id}`);return {saved:true};
}
