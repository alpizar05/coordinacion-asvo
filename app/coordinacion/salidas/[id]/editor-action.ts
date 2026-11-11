'use server';
import { staff,canOperate } from '../../../../lib/auth';
import { sql } from '../../../../lib/db';
import { uuid } from '../../../../lib/registration';
import { OutingEditError,saveOutingEditor } from '../../../../lib/outing-editor';
import { preparePhoto,storeOriginal } from '../../../../lib/outing-photos';
import { dispatchRegistrationUpdates } from '../../../../lib/registration-workflow';
import { revalidatePath } from 'next/cache';
export async function saveOutingEdit(id:string,form:FormData):Promise<{error?:string;target?:string;saved?:boolean}>{
 const user=await staff();
 if(!user||!uuid(id))return {error:'No tenés permiso para editar la salida.',target:'form'};
 try{
  const files=[...form.entries()].filter(([key,value])=>key.startsWith('photo-new-')&&value instanceof File).map(([,value])=>value as File);
  if(files.reduce((sum,f)=>sum+f.size,0)>3.75*1024*1024)throw new OutingEditError('photos','Las fotos nuevas deben pesar hasta 3,75 MB en conjunto.');
  await sql.begin(tx=>saveOutingEditor(tx,id,form,{actor:user.subject,canOperate:unit=>canOperate(user,unit),upload:async key=>{
   const file=form.get(`photo-${key}`);
   if(!(file instanceof File))throw new OutingEditError('photos','No se encontró el archivo de la foto.');
   try{const prepared=await preparePhoto(file),original=await storeOriginal(prepared);return {...original,thumbnail:prepared.thumbnail,display:prepared.display};}
   catch{throw new OutingEditError('photos','No se pudo guardar una foto. Tus cambios se conservan para reintentar.');}
  }}));
 }catch(error){if(error instanceof OutingEditError)return {error:error.message,target:error.target};console.error('No se pudo guardar el editor de salida.');return {error:'No se pudo guardar. Tus cambios se conservan para reintentar.',target:'form'};}
 await dispatchRegistrationUpdates();
 revalidatePath(`/coordinacion/salidas/${id}`);revalidatePath(`/convocatorias/${id}`);revalidatePath('/');
 return {saved:true};
}
