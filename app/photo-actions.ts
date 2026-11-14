'use server';
import {validatePhoto} from '../lib/outing-form-validation';
import {PhotoMutationError} from '../lib/photo-result';
import {legacyResultMessage} from '../lib/legacy-operation-result';
import {checkedFormResult} from '../lib/form-result';
import type {FormResult} from '../lib/form-result';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {staff} from '../lib/auth';
import {sql} from '../lib/db';
import {field,uuid} from '../lib/registration';
import {preparePhoto,graphPhotoStore} from '../lib/outing-photos';
import {PhotoUploadError,withPhotoUploads} from '../lib/photo-upload-workflow';
import {authorizePhotoMutation,savePhotoMutation} from '../lib/photo-mutation';
export async function managePhoto(id:string,form:FormData):Promise<never>{
 if(!uuid(id))redirect('/coordinacion/convocatorias?error='+encodeURIComponent('La convocatoria no es válida.'));
 let result:FormResult;
 try{result=checkedFormResult(await mutatePhoto(id,form));}catch{result={error:'No se pudo procesar la foto. Volvé a intentarlo.'};}
 const back=`/coordinacion/salidas/${id}`;
 redirect(result.saved === true?`${back}?editar=1&confirmacion=foto#fotos`:`${back}?editar=1&error=${encodeURIComponent(legacyResultMessage(result))}#fotos`);
}

export async function attachOutingPhoto(id:string,form:FormData):Promise<FormResult>{
 if(!['agregar','galeria','editar'].includes(field(form,'action')))return {error:'Elegí cómo agregar la foto.'};
 return mutatePhoto(id,form);
}
async function mutatePhoto(id:string,form:FormData):Promise<FormResult>{
 const principal=await staff();if(!principal||!uuid(id))return {error:'No tenés permiso para gestionar esta convocatoria.'};
 const action=field(form,'action');
 if(['agregar','galeria','editar'].includes(action)){const fieldErrors=validatePhoto(form,{mode:action==='agregar'?'upload':action==='editar'?'edit':'gallery'});if(action==='galeria'&&!form.has('alt'))delete fieldErrors.alt;if(Object.keys(fieldErrors).length)return {fieldErrors};}
 const file=form.get('photo'),files=field(form,'action')==='agregar'&&file instanceof File?[{key:'upload',file}]:[];
 try{
  await withPhotoUploads({sql,principal,scope:`photo:${id}`,form,files,prepare:preparePhoto,store:graphPhotoStore(),
   authorize:(tx,user)=>authorizePhotoMutation(tx,id,user),
   validate:(tx,user)=>savePhotoMutation(tx,id,form,user,{preflightOnly:true}),
   commit:async(tx,user,uploads,snapshot)=>{await savePhotoMutation(tx,id,form,user,{expectedVersion:String(snapshot),prepared:uploads.get('upload')});return {saved:true};},
  });
 }catch(error){
  if(error instanceof PhotoUploadError){
   if(error.kind==='provider')return {error:error.message};
   const messages=Object.values(error.fieldErrors).flat();return {fieldErrors:{photo:messages}};
  }
  if(error instanceof PhotoMutationError)return error.fieldErrors?{fieldErrors:error.fieldErrors}:{error:error.message};
  return {error:'No se pudo procesar la foto. Tus datos se conservan para reintentar.'};
 }
 revalidatePath(`/coordinacion/salidas/${id}`);revalidatePath(`/convocatorias/${id}`);return {saved:true};
}
