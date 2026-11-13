import type {FieldErrors} from './form-result';
export type EditorPhoto={key:string;kind:'existing'|'gallery'|'upload';id?:string;permission?:boolean;alt:string;credit:string};
/** Decode structure before any property access, coercion, upload or SQL operation. */
export function parsePhotoMetadata(raw:unknown):{photos:EditorPhoto[];fieldErrors:FieldErrors}{
 const errors:FieldErrors={},photos:EditorPhoto[]=[],keys=new Set(),ids=new Set();
 let parsed:unknown;try{parsed=typeof raw==='string'?JSON.parse(raw):null;}catch{parsed=null;}
 if(!Array.isArray(parsed)||parsed.length>6)return {photos,fieldErrors:{photos:'Elegí hasta seis fotos válidas.'}};
 for(const entry of parsed){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)){errors.photos='Revisá los datos de las fotos.';continue;}
  const p=entry as Record<string,unknown>;
  if(typeof p.key!=='string'||! /^[\w-]{1,128}$/.test(p.key)||keys.has(p.key)||!['existing','gallery','upload'].includes(String(p.kind))){errors.photos='Revisá las fotos: identificador inválido o repetido.';continue;}
  const key=p.key;keys.add(key);
  if(typeof p.alt!=='string'||!p.alt.trim()||p.alt.length>240)errors[`${key}-alt`]='Indicá una descripción de hasta 240 caracteres.';
  if(typeof p.credit!=='string'||p.credit.length>150)errors[`${key}-credit`]='Usá hasta 150 caracteres para el crédito.';
  if(p.kind==='upload'){
   if(!/^new-[\w-]+$/.test(key))errors.photos='Revisá el identificador de la foto nueva.';
   if(p.permission!==true)errors[`${key}-permission`]='Confirmá la autorización para publicar esta foto.';
  }else if(typeof p.id!=='string'||! /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.id)||ids.has(p.id))errors[`${key}-photoId`]='Seleccioná una foto válida sin repetir.';
  else ids.add(p.id);
  photos.push(p as EditorPhoto);
 }
 return {photos,fieldErrors:errors};
}
