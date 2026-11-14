'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CoordinationModal} from './coordination-modal';
import {OutingPhotoGallery} from './outing-photo-gallery';
import type {GalleryPhoto} from '../../lib/outing-photo-gallery';
import {outingPhotoMaxBytes} from '../../lib/outing-photo-limits';
import {validatePhoto} from '../../lib/outing-form-validation';
import type {FormResult} from '../../lib/form-result';
import {checkedPhotoResult,type PhotoPreparationResult} from '../../lib/photo-result';
import {FormFeedbackProvider,FormErrorSummary,FormField,useFormFeedback} from '../form-feedback/form-feedback';
export type PhotoChoice={alt:string;credit:string}&({kind:'upload';file:File}|{kind:'gallery';id:string}|{kind:'edit';id:string});
export function PhotoPreview({file,alt}:{file:File;alt:string}){const[url,setUrl]=useState('');useEffect(()=>{const value=URL.createObjectURL(file);setUrl(value);return()=>URL.revokeObjectURL(value);},[file]);return url?<img className="photo-dialog-preview" src={url} alt={alt}/>:null;}
export type PhotoDialogProps={gallery?:GalleryPhoto[];selected?:string[];initial?:PhotoChoice;disabled?:boolean;maxUploadBytes?:number;feedbackFields?:string;feedbackLabel?:string}&(
 {operation:'prepare';onSave:(photo:PhotoChoice)=>PhotoPreparationResult|Promise<PhotoPreparationResult>}|
 {operation:'persist';onSave:(photo:PhotoChoice)=>Promise<FormResult>});
export function PhotoDialog({gallery=[],selected=[],initial,disabled=false,maxUploadBytes=outingPhotoMaxBytes,onSave,operation,feedbackFields,feedbackLabel}:PhotoDialogProps){
 const[open,setOpen]=useState(false),[mode,setMode]=useState<'gallery'|'upload'>('gallery'),[file,setFile]=useState<File|null>(null),[photoId,setPhotoId]=useState(''),[alt,setAlt]=useState(''),[credit,setCredit]=useState(''),[permission,setPermission]=useState(false),[dirty,setDirty]=useState(false),[pending,setPending]=useState(false);
 const form=useRef<HTMLFormElement>(null),busy=useRef(false),id=useId();
 const data=()=>{const f=new FormData();if(file)f.set('photo',file);f.set('photoId',photoId);f.set('alt',alt);f.set('credit',credit);if(permission)f.set('permission','on');return f;};
 const validate=()=>validatePhoto(data(),{mode:initial?.kind==='edit'?'edit':mode,maxBytes:maxUploadBytes,authorized:!!initial});
 const feedback=useFormFeedback({form,validate,revealField:name=>{if(!initial&&(name==='photoId'||name==='photo'||name==='permission'))setMode(name==='photoId'?'gallery':'upload');}});
 const changed=(name:string)=>{setDirty(true);requestAnimationFrame(()=>feedback.changed(name));};
 async function save(){if(busy.current)return;const errors=validate();if(Object.keys(errors).length){feedback.showErrors(errors);return;}busy.current=true;setPending(true);
  try{
   const choice:PhotoChoice=initial?.kind==='edit'?{kind:'edit',id:initial.id,alt:alt.trim(),credit:credit.trim()}:mode==='upload'?{kind:'upload',file:file!,alt:alt.trim(),credit:credit.trim()}:{kind:'gallery',id:photoId,alt:alt.trim(),credit:credit.trim()};
   if(choice.kind==='upload'){
    const url=URL.createObjectURL(choice.file);try{const image=new Image();image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>24_000_000){feedback.showErrors({photo:'La imagen supera 24 megapíxeles.'});return;}}catch{feedback.showErrors({photo:'No se pudo leer la imagen. Elegí un JPG, PNG o WebP válido.'});return;}finally{URL.revokeObjectURL(url);}
   }
   const result=checkedPhotoResult(await onSave(choice),operation);if(result.saved===true||('prepared'in result&&result.prepared===true)){setDirty(false);setOpen(false);}else feedback.showErrors(result.fieldErrors,result.error);
  }catch{feedback.showErrors({},'No se pudo guardar la foto. El archivo y sus datos se conservan para reintentar.');}finally{busy.current=false;setPending(false);}
 }
 return <><button type="button" disabled={disabled} aria-haspopup="dialog" data-feedback-fields={feedbackFields} data-feedback-label={feedbackLabel} onClick={()=>{setFile(initial?.kind==='upload'?initial.file:null);setPhotoId(initial&&initial.kind!=='upload'?initial.id:'');setAlt(initial?.alt||'');setCredit(initial?.credit||'');setPermission(!!initial);setMode(initial?.kind==='upload'||!gallery.length?'upload':'gallery');feedback.reset();setDirty(false);setOpen(true);}}>{initial?'Editar foto':'Agregar foto'}</button>
 {open&&createPortal(<CoordinationModal open={open} onClose={()=>setOpen(false)} title={initial?'Editar foto':'Agregar foto'} wide dirty={dirty} pending={pending} footer={<button type="submit" form={id} disabled={pending} className="coord-button-primary">{pending?'Guardando…':initial?'Guardar cambios':'Agregar foto'}</button>}>
 <FormFeedbackProvider feedback={feedback}><form ref={form} id={id} noValidate onSubmit={e=>{e.preventDefault();e.stopPropagation();void save();}}><FormErrorSummary/>
 {!initial&&<div className="photo-source-tabs" role="group" aria-label="Origen de la foto"><button type="button" aria-pressed={mode==='gallery'} onClick={()=>setMode('gallery')}>Galería</button><button type="button" aria-pressed={mode==='upload'} onClick={()=>setMode('upload')}>Subir nueva</button></div>}
 <fieldset disabled={pending} className="photo-dialog-fields">
 <div hidden={mode!=='gallery'||!!initial}><input type="hidden" name="photoId" value={photoId}/><FormField name="photoId" label="Selección de galería"><button type="button" name="photoId" onClick={()=>{setPhotoId('');changed('photoId');}}>Elegir foto de la galería</button></FormField>
 {!photoId&&<OutingPhotoGallery gallery={gallery} selected={selected} disabled={pending} actionLabel="Seleccionar foto" onAdd={p=>{setPhotoId(p.id);setAlt(p.alt);setCredit(p.credit||'');changed('photoId');requestAnimationFrame(()=>{feedback.changed('alt');feedback.changed('credit');});}}/>}</div>
 <div hidden={mode!=='upload'||initial?.kind==='edit'}><FormField name="photo" label="Archivo · JPG, PNG o WebP, hasta 3 MB"><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{setFile(e.target.files?.[0]||null);changed('photo');}}/></FormField>{file&&<p>{file.name}</p>}</div>
 {file&&mode==='upload'?<PhotoPreview file={file} alt={alt||file.name}/>:photoId?<img className="photo-dialog-preview" src={`/api/fotos/${photoId}?v=tarjeta`} alt={alt||'Foto seleccionada'}/>:null}
 <FormField name="alt" label="Descripción de la foto"><input name="alt" value={alt} onChange={e=>{setAlt(e.target.value);changed('alt');}}/></FormField><FormField name="credit" label="Crédito de la foto"><input name="credit" value={credit} onChange={e=>{setCredit(e.target.value);changed('credit');}}/></FormField>
 {mode==='upload'&&!initial&&<FormField name="permission" label="La foto está autorizada para publicación."><input name="permission" type="checkbox" checked={permission} onChange={e=>{setPermission(e.target.checked);changed('permission');}}/></FormField>}
 </fieldset></form></FormFeedbackProvider></CoordinationModal>,document.body)}</>;
}
