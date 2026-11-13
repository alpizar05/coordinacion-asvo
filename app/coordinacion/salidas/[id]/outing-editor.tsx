'use client';
import {preserveCurrentNavigation} from '../../navigation-position';
import { useEffect,useRef,useState,type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { commonOutingFields,supportRequestFields } from '../../../../lib/collection-fields';
import { outingLogisticsFields } from '../../../../lib/outing-logistics';
import type { GalleryPhoto } from '../../../../lib/outing-photo-gallery';
import { PhotoDialog,PhotoPreview,type PhotoChoice } from '../../photo-dialog';
import { CoordinationModal } from '../../coordination-modal';
import {FormFeedbackProvider,FormErrorSummary,FormFeedbackBindings,useFormFeedback} from '../../../form-feedback/form-feedback';
import {validateOutingEdit} from '../../../../lib/outing-form-validation';
import { saveOutingEdit } from './editor-action';
const sections=[['general','Información general'],['dates','Fechas y cupos'],['logistics','Participación y logística'],['photos','Fotos'],['publication','Publicación']] as const;
type Section=typeof sections[number][0];
type Photo={key:string;kind:'existing'|'gallery'|'upload';id?:string;file?:File;permission?:boolean;alt:string;credit:string};
export type OutingEditorProps={isSeries:boolean;id:string;version:string;initial:Record<string,string>;defaults:Record<string,string>;overrides:string[];units:string[];photos:{id:string;alt:string;credit:string}[];gallery:GalleryPhoto[];request:Record<string,string>;canEditRequest:boolean;related:{id:string;title:string;starts:string;ends:string}[];inheritsPhotos:boolean;hasGeneralPhotos:boolean;actions:ReactNode};
export function OutingEditor(props:OutingEditorProps){
 const root=useRef<HTMLDivElement>(null),photoOperation=useRef('');
 const router=useRouter(),form=useRef<HTMLFormElement>(null),busy=useRef(false);
 const [section,setSection]=useState<Section>('general'),[selector,setSelector]=useState(false),[dirty,setDirty]=useState(false),[pending,setPending]=useState(false),[discard,setDiscard]=useState<string|null>(null);

 const [personal,setPersonal]=useState(props.overrides),[values,setValues]=useState(props.initial);
 const [photos,setPhotos]=useState<Photo[]>(props.photos.map(p=>({...p,key:p.id,kind:'existing'})));
 const [photoMode,setPhotoMode]=useState('keep');
 const back=`/coordinacion/salidas/${props.id}`;
 useEffect(()=>{const node=root.current;if(!node)return;const reveal=(event:Event)=>{if(event.target instanceof Element&&event.target.closest('.editor-terminal'))setSection('publication');};node.addEventListener('asvo:reveal-form',reveal);return()=>node.removeEventListener('asvo:reveal-form',reveal);},[]);
 useEffect(()=>{
  const unload=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};
  const navigation=(e:MouseEvent)=>{const a=(e.target as Element)?.closest?.('a');if(dirty&&!pending&&a?.href&&a.origin===location.origin&&!a.download&&!e.metaKey&&!e.ctrlKey&&e.button===0){e.preventDefault();setDiscard(a.href);}};
  window.addEventListener('beforeunload',unload);document.addEventListener('click',navigation,true);
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',navigation,true);};
 },[dirty,pending]);
 const update=(name:string,value:string)=>{setValues(v=>({...v,[name]:value}));setDirty(true);};
 const dateChanged=values.starts!==props.initial.starts||values.ends!==props.initial.ends||values.mode!==props.initial.mode;
 const capacityChanged=values.capacity!==props.initial.capacity;
 const sectionFor=(target:string):Section=>target==='photos'?'photos':target==='registrationDeadline'||target==='visibility'?'publication':['starts','ends','mode','dateReason','capacity','capacityReason'].includes(target)?'dates':target==='plan'||outingLogisticsFields.some(f=>f.name===target)||['requirements','logistics','request-plan'].includes(target)?'logistics':'general';
 const prepare=(data:FormData)=>{data.set('photoMode',photoMode);data.set('photos',JSON.stringify(photos.map(({file,...p})=>p)));for(const p of photos)if(p.file)data.set(`photo-${p.key}`,p.file);return data;};
 const feedback=useFormFeedback({form,dependencies:{starts:['ends','dateReason','registrationDeadline'],ends:['dateReason'],mode:['dateReason'],capacity:['capacityReason'],...Object.fromEntries(supportRequestFields.map(f=>[`request-${f.name}`,['confirmShared']]))},validate:data=>validateOutingEdit(prepare(data),props.initial,props.defaults,props.isSeries,0,props.request,props.related.length>1),revealField:name=>setSection(name.startsWith('new-')||photos.some(p=>name.startsWith(p.key))?'photos':sectionFor(name))});
 useEffect(()=>{for(const name of Object.keys(feedback.fieldErrors))if(name==='photos'||name.startsWith('new-')||/^[0-9a-f]{8}-/.test(name))feedback.changed(name);},[photos,photoMode]);
 function inherited(item:typeof commonOutingFields[number]){
  const custom=!props.isSeries||personal.includes(item.name),value=custom?values[item.name]:props.defaults[item.name]||'';
  return <div className="editor-inherited" key={item.name}>
   <div className="editor-field-heading"><span>{item.label}</span>{props.isSeries&&<button type="button" className="editor-text-action" data-feedback-fields={item.name} data-feedback-label={item.label} onClick={()=>{setPersonal(p=>custom?p.filter(k=>k!==item.name):[...p,item.name]);setDirty(true);}}>{custom?'Usar dato general':'Personalizar este bloque'}</button>}</div>
   <p hidden={!props.isSeries} className="editor-inheritance-label">{custom?'Personalizado para este bloque':'Heredado de la convocatoria general'}</p>
   {custom&&<input type="hidden" name="personal" value={item.name}/>}
   {item.name==='unit'?<select name={item.name} aria-label={item.label} value={value} disabled={!custom||pending}  onChange={e=>update(item.name,e.target.value)}>
    {!props.units.includes(value)&&<option value={value}>{value}</option>}{props.units.map(u=><option key={u}>{u}</option>)}</select>
    :item.multiline?<textarea name={item.name} aria-label={item.label} value={value} disabled={!custom||pending} maxLength={5000}  onChange={e=>update(item.name,e.target.value)}/>
    :<input name={item.name} aria-label={item.label} value={value} disabled={!custom||pending} maxLength={240}  onChange={e=>update(item.name,e.target.value)}/>}

  </div>;
 }
 function photoChange(next:Photo[]){setPhotos(next);setPhotoMode('personal');setDirty(true);}
 const addPhoto=(choice:PhotoChoice)=>{if(photos.length>=6)return 'Podés agregar hasta seis fotos.';photoChange([...photos,{...choice,permission:choice.kind==='upload'?true:undefined,kind:choice.kind==='edit'?'existing':choice.kind,key:choice.kind==='upload'?`new-${crypto.randomUUID()}`:choice.id}]);};
 async function save(){
  if(!form.current||busy.current)return;
  const data=new FormData(form.current);if(!photoOperation.current)photoOperation.current=crypto.randomUUID();data.set('photoOperation',photoOperation.current);data.set('version',props.version);data.set('photoMode',photoMode);
  data.set('photos',JSON.stringify(photos.map(({file,...p})=>p)));
  for(const p of photos)if(p.file)data.set(`photo-${p.key}`,p.file);
  const errors=validateOutingEdit(data,props.initial,props.defaults,props.isSeries,0,props.request,props.related.length>1);if(Object.keys(errors).length){feedback.showErrors(errors);return;}
  busy.current=true;setPending(true);
  try{const result=await saveOutingEdit(props.id,data);if(result.saved){setDirty(false);router.replace(preserveCurrentNavigation(`${back}?guardada=1`));router.refresh();}
   else feedback.showErrors(result.fieldErrors,result.error);}
  catch{feedback.showErrors({},'No se pudo guardar. Los datos y archivos se conservan para reintentar.');}
  finally{busy.current=false;setPending(false);}

 }
 return <FormFeedbackProvider feedback={feedback}><div ref={root} className="outing-editor">
  <div className="outing-editor-bar" role="region" aria-label="Acciones de edición"><div><strong>Modo edición</strong><span role="status">{pending?'Guardando…':dirty?'Cambios sin guardar':props.isSeries?'Editando este bloque':'Editando la convocatoria'}</span></div><div className="actions"><button type="button" disabled={pending} onClick={()=>dirty?setDiscard(back):router.push(preserveCurrentNavigation(back))}>Descartar</button><button type="button" className="coord-button-primary" disabled={pending||!dirty} onClick={save}>{pending?'Guardando…':'Guardar cambios'}</button></div></div>
  <div className="outing-editor-layout">
   <nav className="outing-editor-nav" aria-label="Secciones del editor">{sections.map(([key,label],i)=><button type="button" key={key} aria-current={section===key?'step':undefined} onClick={()=>setSection(key)}><span aria-hidden="true">{i+1}</span>{label}</button>)}</nav>
   <div className="outing-editor-content">
    <button type="button" className="outing-editor-section-trigger" aria-haspopup="dialog" onClick={()=>setSelector(true)}>Sección: {sections.find(([key])=>key===section)?.[1]} <span aria-hidden="true">⌄</span></button>
    <form ref={form} noValidate onChange={e=>{setDirty(true);const t=e.target;if(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement)requestAnimationFrame(()=>feedback.changed(t.name));}} onSubmit={e=>{e.preventDefault();void save();}}>
     <fieldset disabled={pending} className="editor-fields">
      <FormErrorSummary/><FormFeedbackBindings form={form}/>
      <section className="card editor-section" hidden={section!=='general'} aria-labelledby="editor-general"><h2 id="editor-general">Información general</h2>{props.isSeries&&<p className="muted">Los cambios personalizados afectan únicamente este bloque.</p>}{commonOutingFields.slice(0,3).map(inherited)}
       <div className="editor-common-data"><h3>Solicitud de apoyo{props.isSeries?' · Datos comunes':''}</h3><p className="muted">{props.related.length>1?`Compartida por ${props.related.length} bloques. Los cambios en esta solicitud se aplican a todos.`:'Información de la organización que solicita el apoyo.'}</p>
       {props.canEditRequest&&<input type="hidden" name="editRequest" value="1"/>}
       {supportRequestFields.filter(f=>f.name!=='plan').map(f=><label key={f.name}>{f.label}<input name={`request-${f.name}`} defaultValue={props.request[f.name]||''} readOnly={!props.canEditRequest} maxLength={5000} /></label>)}
       {!props.canEditRequest&&<p className="muted">Para editar estos datos se requiere acceso a todos sus bloques.</p>}
       {props.canEditRequest&&props.related.length>1&&<><details><summary>Ver bloques afectados</summary><ul>{props.related.map(b=><li key={b.id}>{b.title} · {b.starts} — {b.ends}</li>)}</ul></details><label><input type="checkbox" name="confirmShared"/> Confirmo los cambios de datos comunes para todos los bloques.</label></>}
       </div>
      </section>
      <section className="card editor-section" hidden={section!=='dates'} aria-labelledby="editor-dates"><h2 id="editor-dates">Fechas y cupos</h2><div className="editor-two-columns">{[['starts','Inicio'],['ends','Fin']].map(([name,label])=><label key={name}>{label}<input name={name} type="date" value={values[name]}  onChange={e=>update(name,e.target.value)}/></label>)}</div>
       <label>Modalidad<select name="mode" value={values.mode} onChange={e=>update('mode',e.target.value)}><option value="fija">Fechas fijas</option><option value="flexible">Fechas flexibles</option></select></label>
       {dateChanged&&<label>Motivo del cambio de fechas o modalidad<input name="dateReason" maxLength={4000} /></label>}
       <div className="editor-subsection"><label>Cupo total<input name="capacity" type="number" min="1" max="10000" value={values.capacity} onChange={e=>update('capacity',e.target.value)} /></label>
       {capacityChanged&&<label>Motivo del ajuste de cupos<input name="capacityReason" maxLength={4000} /></label>}</div>
      </section>
      <section className="card editor-section" hidden={section!=='logistics'} aria-labelledby="editor-logistics"><h2 id="editor-logistics">Participación y logística</h2>{commonOutingFields.slice(3).map(inherited)}
       <label>Plan de trabajo{props.isSeries?' · Dato común':''}<textarea name="request-plan" defaultValue={props.request.plan||''} readOnly={!props.canEditRequest} maxLength={5000}/></label><p className="muted">{props.isSeries?'El plan pertenece a la solicitud de apoyo y se comparte entre sus bloques.':'El plan pertenece a la solicitud de apoyo de esta convocatoria.'}</p>
       <div className="editor-subsection"><h3>Condiciones de {props.isSeries?'este bloque':'la salida'}</h3>{outingLogisticsFields.map(f=><label key={f.name}>{f.label}<textarea name={f.name} defaultValue={props.initial[f.name]||''} placeholder={f.placeholder} maxLength={5000} /></label>)}</div>
      </section>
      <section className="card editor-section" tabIndex={-1} data-feedback-fields="photos" data-feedback-label="Fotos de la convocatoria" hidden={section!=='photos'} aria-labelledby="editor-photos"><h2 id="editor-photos">Fotos</h2><p><span className="pill">{photos.length} de 6</span> La primera foto será la portada.</p><p className="muted">Los cambios de fotos se aplican al guardar la convocatoria.</p>
       {photoMode==='inherit'?<p>Se restaurarán las fotos generales al guardar. <button type="button" onClick={()=>{setPhotoMode('keep');setDirty(true);}}>Conservar selección actual</button></p>:<>
       <ol className="editor-photo-list">{photos.map((p,i)=><li key={p.key}>{p.file?<PhotoPreview file={p.file} alt={p.alt}/>:<img src={`/api/fotos/${p.id}?v=tarjeta`} alt={p.alt}/>}<div><strong>{i===0?'Portada · ':''}{p.alt}</strong><p className="muted">{p.credit}</p><div className="actions">
       <PhotoDialog feedbackLabel={`Foto ${i+1}${p.file?` · ${p.file.name}`:''}`} feedbackFields={`${p.key} ${p.key}-photo ${p.key}-alt ${p.key}-credit ${p.key}-permission`} gallery={props.gallery} initial={p.kind==='upload'?{kind:'upload',file:p.file!,alt:p.alt,credit:p.credit}:{kind:'edit',id:p.id!,alt:p.alt,credit:p.credit}} onSave={choice=>photoChange(photos.map(current=>current.key===p.key?{...current,alt:choice.alt,credit:choice.credit}:current))}/>
       {i>0&&<button type="button" onClick={()=>photoChange([p,...photos.filter(x=>x.key!==p.key)])}>Hacer portada</button>}
       {i>0&&<button type="button" aria-label={`Subir foto ${i+1}`} onClick={()=>{const next=[...photos];[next[i-1],next[i]]=[next[i],next[i-1]];photoChange(next);}}>↑</button>}
       <button type="button" onClick={()=>photoChange(photos.filter(x=>x.key!==p.key))}>Quitar</button></div></div></li>)}</ol>
       <PhotoDialog feedbackFields="photos" feedbackLabel="Fotos de la convocatoria" gallery={props.gallery} selected={photos.filter(p=>p.id).map(p=>p.id!)} disabled={photos.length>=6} maxUploadBytes={Math.max(0,3.75*1024*1024-photos.reduce((n,p)=>n+(p.file?.size||0),0))} onSave={addPhoto}/></>}
       <p hidden={!props.isSeries} className="muted">{props.inheritsPhotos?'El bloque usa las fotos generales; personalizarlas afecta solo este bloque.':'El bloque tiene una galería propia.'}</p>
       {props.isSeries&&props.hasGeneralPhotos&&photoMode!=='inherit'&&<button type="button" onClick={()=>{setPhotoMode('inherit');setDirty(true);}}>Usar fotos generales</button>}
      </section>
      <section className="card editor-section" hidden={section!=='publication'} aria-labelledby="editor-publication"><h2 id="editor-publication">Publicación</h2><label>Visibilidad<select name="visibility" defaultValue={props.initial.visibility}><option value="publica">Pública · visible en el catálogo si está abierta</option><option value="privada">Privada · solo por enlace directo</option></select></label>
       <label>Fecha límite de inscripción<input name="registrationDeadline" type="date" defaultValue={props.initial.registrationDeadline} max={values.starts} /></label><p className="muted">Al terminar ese día, hora de Costa Rica, solo podrán inscribirse las personas invitadas.</p></section>
     </fieldset>
    </form>
    <details className="editor-terminal" hidden={section!=='publication'}><summary>Acciones de la convocatoria</summary>{dirty&&<p className="muted">Guardá o descartá los cambios antes de completar, cancelar o eliminar la convocatoria.</p>}<fieldset disabled={dirty||pending}>{props.actions}</fieldset></details>
   </div>
  </div>
  <CoordinationModal open={selector} onClose={()=>setSelector(false)} title="Sección del editor"><div className="editor-section-options">{sections.map(([key,label])=><button type="button" key={key} aria-pressed={section===key} onClick={()=>{setSection(key);setSelector(false);}}>{label}</button>)}</div></CoordinationModal>
  <CoordinationModal open={!!discard} onClose={()=>setDiscard(null)} title="Descartar cambios" footer={<button type="button" className="coord-button-danger" onClick={()=>{const href=discard||back;setDirty(false);setDiscard(null);router.push(preserveCurrentNavigation(href));}}>Descartar y salir</button>}><p>Los cambios de este editor todavía no se guardaron. ¿Querés descartarlos?</p></CoordinationModal>
 </div></FormFeedbackProvider>;
}
