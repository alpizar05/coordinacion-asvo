'use client';

import { outingLogisticsFields } from '../../../../lib/outing-logistics';
import { FlexibleDatesHelp } from '../../flexible-dates-help';

import { useEffect, useRef, useState } from 'react';
import { CoordinationModal } from '../../coordination-modal';
import { useRouter } from 'next/navigation';
import { createOuting } from '../../../staff-actions';
import { outingPhotoBatchMaxBytes, outingPhotoLimit, outingPhotoMaxBytes } from '../../../../lib/outing-photo-limits';
import type { GalleryPhoto } from '../../../../lib/outing-photo-gallery';
import { PhotoDialog } from '../../photo-dialog';
import {FormFeedbackProvider,FormErrorSummary,FormFeedbackBindings,useFormFeedback} from '../../../form-feedback/form-feedback';
import {validateNewOuting} from '../../../../lib/outing-form-validation';
import type {FieldErrors} from '../../../../lib/form-result';
import { OutingPeriods, type OutingPeriod } from '../../outing-periods';

export type OutingTemplate = {
  id: string; request_id: string; title: string; location: string; unit: string;
  starts: string; ends: string; flexible: boolean; capacity: number; listed: boolean;
  requirements: string | null; logistics: string | null; transport_details: string; food_details: string; lodging_details: string; registration_deadline: string | null;
  organization: string | null; contact: string | null; area: string | null; activity: string | null; plan: string | null;
  photos: { id: string; alt: string; credit?: string }[];
};

type NewPhoto = { id: number; file: File; alt: string; credit: string };

function LocalPhotoThumbnail({ file, alt }: { file: File; alt: string }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    if (!element) return;
    const url = URL.createObjectURL(file);
    element.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={image} alt={alt} />;
}

export function NewOutingForm({ clone, gallery, templates, units }: {
  clone?: OutingTemplate; gallery: GalleryPhoto[]; templates: OutingTemplate[]; units: string[];
}) {
  const router = useRouter();
  const editorSections=[['general','Información general'],['dates','Fechas y cupos'],['logistics','Participación y logística'],['photos','Fotos'],['publication','Publicación']] as const;
  const [section,setSection]=useState('general');
  const [selector,setSelector]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [discard,setDiscard]=useState<string|null>(null);
  const back=clone ? `/coordinacion/colecciones/automaticas/${clone.request_id}#bloques` : '/coordinacion/convocatorias#salidas';
  const formRef=useRef<HTMLFormElement>(null),busy=useRef(false);
  const [pending,setPending]=useState(false);
  const defaultUnit = units.includes('Voluntariado General') ? 'Voluntariado General' : units[0] ?? '';
  const [periods, setPeriods] = useState<OutingPeriod[]>([{ id: 1, start: '', end: '' }]);
  const [title, setTitle] = useState(clone?.title ?? '');
  const [unit, setUnit] = useState(clone?.unit ?? defaultUnit);
  const [capacity, setCapacity] = useState(clone ? String(clone.capacity) : '');
  const [visibility, setVisibility] = useState(clone && !clone.listed ? 'privada' : 'publica');
  const [deadline, setDeadline] = useState('');
  const [selected, setSelected] = useState(clone?.request_id ?? '');
  const nextPhotoId = useRef(1);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [cover, setCover] = useState<string | File>('');
  const [photos, setPhotos] = useState<OutingTemplate['photos']>(clone?.photos ?? []);
  const template = templates.find(row => row.request_id === selected);

  const photoCount = photos.length + newPhotos.length;
  const hasPhotoSpace = photoCount < outingPhotoLimit;
  const selectedPhotos = [
    ...photos.map(photo => ({ kind: 'existing' as const, photo })),
    ...newPhotos.map(photo => ({ kind: 'new' as const, photo })),
  ];
  const currentCover = cover || photos[0]?.id || (newPhotos.length ? newPhotos[0].file : '');

  const initialized=useRef(false);
  useEffect(()=>{if(initialized.current)setDirty(true);else initialized.current=true;},[photos,newPhotos,cover,periods]);
  useEffect(()=>{
    const unload=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};
    const navigate=(event:MouseEvent)=>{const link=(event.target as Element)?.closest?.('a');if(dirty&&!pending&&link?.href&&link.origin===location.origin&&!event.ctrlKey&&!event.metaKey&&event.button===0){event.preventDefault();setDiscard(link.href);}};
    window.addEventListener('beforeunload',unload);document.addEventListener('click',navigate,true);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',navigate,true);};
  },[dirty,pending]);

  const reveal=(target:string)=>setSection(target.startsWith('new-')||target.startsWith('existing-')||target==='photos'?'photos':target==='dates'||target.startsWith('period-')||target==='capacity'?'dates':target==='registrationDeadline'||target==='visibility'?'publication':target==='plan'||outingLogisticsFields.some(f=>f.name===target)||['requirements','logistics'].includes(target)?'logistics':'general');
  const feedback=useFormFeedback({form:formRef,dependencies:Object.fromEntries(periods.flatMap(p=>[[`period-${p.id}-starts`,[`period-${p.id}-ends`,'registrationDeadline']],[`period-${p.id}-ends`,[`period-${p.id}-starts`]]])),revealField:reveal,validate:data=>{newPhotos.forEach((photo,index)=>{data.set(`photo-${index}`,photo.file);data.set(`alt-${index}`,photo.alt);data.set(`credit-${index}`,photo.credit);data.set(`permission-${index}`,'on');});data.set('action','publicar');return mapErrors(validateNewOuting(data));}});
  useEffect(()=>{for(const name of Object.keys(feedback.fieldErrors))if(name==='photos'||name.startsWith('new-')||name.startsWith('existing-'))feedback.changed(name);},[photos,newPhotos]);
  const mapErrors=(errors:FieldErrors)=>Object.fromEntries(Object.entries(errors).map(([key,value])=>[key.replace(/^new-(\d+)(?=-|$)/,(_,index)=>`new-${newPhotos[Number(index)]?.id??index}`),value]));
  return <FormFeedbackProvider feedback={feedback}><form ref={formRef} className="outing-editor new-outing-editor" method="post" noValidate onChange={e=>{setDirty(true);const t=e.target;if(t instanceof HTMLInputElement||t instanceof HTMLSelectElement||t instanceof HTMLTextAreaElement)requestAnimationFrame(()=>feedback.changed(t.name));}} onSubmit={async event=>{
    event.preventDefault();if(busy.current)return;
    const data=new FormData(event.currentTarget,(event.nativeEvent as SubmitEvent).submitter);
    newPhotos.forEach((photo,index)=>{data.set(`photo-${index}`,photo.file);data.set(`alt-${index}`,photo.alt);data.set(`credit-${index}`,photo.credit);data.set(`permission-${index}`,'on');});
    const coverSlot=newPhotos.findIndex(photo=>currentCover===photo.file);data.set('photoCover',coverSlot<0?String(currentCover):`new-${coverSlot}`);
    const errors=validateNewOuting(data);if(Object.keys(errors).length){feedback.showErrors(mapErrors(errors));return;}
    busy.current=true;setPending(true);
    try{const result=await createOuting(data);if(result.saved&&result.destination){setDirty(false);router.push(result.destination);}else feedback.showErrors(mapErrors(result.fieldErrors||{}),result.error);}
    catch{feedback.showErrors({},'No se pudo guardar. Los datos y archivos se conservan para reintentar.');}finally{busy.current=false;setPending(false);}
  }}>
    <FormErrorSummary/><FormFeedbackBindings form={formRef}/>
    <div className="outing-editor-bar" role="region" aria-label="Acciones de nueva convocatoria"><div><strong>{clone?'Nuevo bloque':'Nueva convocatoria'}</strong><span role="status">{pending?'Guardando…':dirty?'Cambios sin publicar':'Completá los datos de la salida'}</span></div><div className="actions"><button type="button" disabled={pending} onClick={()=>dirty?setDiscard(back):router.push(back)}>Descartar</button><button type="submit" name="action" value="publicar" disabled={pending} className="coord-button-primary">{pending?'Guardando…':clone?'Publicar bloque':'Publicar convocatoria'}</button></div></div>
    <div className="outing-editor-layout"><nav className="outing-editor-nav" aria-label="Secciones de nueva convocatoria">{editorSections.map(([key,label],i)=><button key={key} type="button" aria-current={section===key?'step':undefined} onClick={()=>setSection(key)}><span aria-hidden="true">{i+1}</span>{label}</button>)}</nav><div className="outing-editor-content">
    <button type="button" className="outing-editor-section-trigger" aria-haspopup="dialog" onClick={()=>setSelector(true)}>Sección: {editorSections.find(([key])=>key===section)?.[1]} <span aria-hidden="true">⌄</span></button>
    <fieldset disabled={pending} className="editor-fields">
    <section className="new-outing-section" hidden={section!=='general'}>
    <h2>Información general</h2>
    {clone ? <>
      <input type="hidden" name="request" value={clone.request_id} />
      <input type="hidden" name="cloneBlock" value={clone.id} />
      <p>Basado en <strong>{clone.title}</strong>. Elegí las fechas del nuevo bloque y ajustá los datos si hace falta.</p>
    </> : <><label>Convocatoria de origen (opcional)<select name="request" aria-describedby={selected ? "outing-origin-help" : undefined} value={selected} onChange={event => {
      const value = event.target.value;
      setSelected(value);
      const source = templates.find(row => row.request_id === value);
      setPeriods([{ id: 1, start: source?.starts ?? '', end: source?.ends ?? '' }]);
      setTitle(source?.title ?? '');
      setUnit(source?.unit ?? defaultUnit);
      setCapacity(source ? String(source.capacity) : '');
      setDeadline(source?.registration_deadline ?? '');
      setVisibility(source && !source.listed ? 'privada' : 'publica');
      setNewPhotos([]);
      setCover('');
      setPhotos(source?.photos ?? []);
    }}>
      <option value="">Crear una convocatoria independiente</option>
      {templates.map(row => <option key={row.request_id} value={row.request_id}>
        {[row.organization, row.activity, row.title, row.starts].filter(Boolean).join(' · ')}
      </option>)}
    </select></label>
    {selected && <p id="outing-origin-help" className="muted">Se copiarán sus datos y fotos. La nueva salida quedará como un bloque de la misma convocatoria en serie. Podés ajustar los detalles antes de publicarla.</p>}
    </>}
    </section>
    <div key={selected} className="new-outing-fields">
    <section className="new-outing-section" hidden={section!=='general'}>
    <div className="grid"><div><label>Título<input name="title" value={title} onChange={event => setTitle(event.target.value)} required/></label></div><div><label>Estación o lugar<input name="location" defaultValue={template?.location} required/></label></div><label>Unidad<select name="unit" value={unit} onChange={event => setUnit(event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label></div>
    </section>
    <section className="new-outing-section" hidden={section!=='general'} aria-labelledby="support-request-title">
    <h2 id="support-request-title">Solicitud de apoyo</h2>
    {template && <p>Los datos del pedido se muestran como referencia. Los datos de la salida se pueden editar.</p>}
    <div className="grid"><label>Organización solicitante<input name="organization" defaultValue={template?.organization ?? ""} readOnly={!!template}/></label><label>Contacto solicitante<input name="contact" defaultValue={template?.contact ?? ""} readOnly={!!template}/></label><label>Área silvestre protegida<input name="area" defaultValue={template?.area ?? ""} readOnly={!!template}/></label><label>Tipo de actividad<input name="activity" defaultValue={template?.activity ?? ""} readOnly={!!template}/></label></div>
    </section>
    <section className="new-outing-section" hidden={section!=='dates'}>
    <h2>Fechas y cupos</h2>

    <OutingPeriods limit={24} periods={periods} onChange={setPeriods} renderError={()=>null} />
    <label>Cupos por bloque<input name="capacity" value={capacity} onChange={event => setCapacity(event.target.value)} type="number" min="1" max="10000" required /></label>

    <FlexibleDatesHelp><label><input type="checkbox" name="flexible" defaultChecked={template?.flexible}/> Fechas flexibles</label></FlexibleDatesHelp>
    </section>
    <section className="new-outing-section" hidden={section!=='logistics'}>
    <h2>Participación y logística</h2>
    <label>Plan de trabajo<textarea name="plan" defaultValue={template?.plan ?? ""} readOnly={!!template}/></label>
    <label>Requisitos públicos<textarea name="requirements" defaultValue={template?.requirements ?? ""}/></label><label>Logística pública<textarea name="logistics" defaultValue={template?.logistics ?? ""} placeholder="Otras indicaciones: instalaciones, herramientas y aspectos adicionales"/></label>
    <h3>Logística del bloque</h3><p className="muted">Información pública para preparar la participación. Cada bloque puede tener sus propias condiciones.</p>

    {outingLogisticsFields.map(item => <label key={item.name}>{item.label}<textarea name={item.name} maxLength={5000} defaultValue={template?.[item.name] ?? ''} placeholder={item.placeholder} /></label>)}
    </section>
    <section className="new-outing-section" hidden={section!=='photos'}>
    <h2>Fotos</h2>
    <fieldset className="outing-photo-field">
      <fieldset className="outing-photo-selection" tabIndex={-1} data-feedback-fields="photos" data-feedback-label="Fotos de la convocatoria">
        <legend aria-live="polite">{photoCount} de {outingPhotoLimit} fotos</legend>

      <p>Elegí hasta seis fotos de la galería o de tu dispositivo y marcá cuál será la portada.</p>
      {selectedPhotos.length > 0 && <ul className="photo-admin-list" aria-label="Fotos seleccionadas">
        {selectedPhotos.map(item => {
          const { photo } = item;
          const identity = item.kind === 'new' ? item.photo.file : item.photo.id;
          const isCover = currentCover === identity;
          return <li key={`${item.kind}-${photo.id}`}>
            {item.kind === 'new'
              ? <LocalPhotoThumbnail file={item.photo.file} alt={photo.alt} />
              : <>
                <input type="hidden" name="copyPhoto" value={photo.id} />
                <input type="hidden" name={`copyAlt-${photo.id}`} value={photo.alt} />
                {photo.credit !== undefined && <input type="hidden" name={`copyCredit-${photo.id}`} value={photo.credit} />}
                <img src={`/api/fotos/${photo.id}?v=tarjeta`} alt={photo.alt} />
              </>}
            <div>

              {isCover && <span className="outing-photo-cover">Portada</span>}
              <strong>{photo.alt || (item.kind === 'new' ? item.photo.file.name : '')}</strong>
              <PhotoDialog feedbackLabel={`Foto ${selectedPhotos.indexOf(item)+1}${item.kind==='new'?` · ${item.photo.file.name}`:''}`} feedbackFields={item.kind==='new'?`new-${photo.id} new-${photo.id}-photo new-${photo.id}-alt new-${photo.id}-credit new-${photo.id}-permission`:`existing-${photo.id} existing-${photo.id}-alt existing-${photo.id}-credit`} initial={item.kind === 'new'
                ? { kind: 'upload', file: item.photo.file, alt: item.photo.alt, credit: item.photo.credit }
                : { kind: 'edit', id: item.photo.id, alt: item.photo.alt, credit: item.photo.credit || '' }}
                onSave={choice => {
                  if (item.kind === 'new') setNewPhotos(current => current.map(entry => entry.id === photo.id ? { ...entry, alt: choice.alt, credit: choice.credit } : entry));
                  else setPhotos(current => current.map(entry => entry.id === photo.id ? { ...entry, alt: choice.alt, credit: choice.credit } : entry));
                }} />
              <div className="actions">
                {!isCover && <button type="button" onClick={() => setCover(identity)}>Hacer portada</button>}
                <button type="button" onClick={() => {
                  if (item.kind === 'new') setNewPhotos(current => current.filter(entry => entry.id !== photo.id));
                  else setPhotos(current => current.filter(entry => entry.id !== photo.id));
                  if (cover === identity) setCover('');
                }}>Quitar foto</button>
              </div>
            </div>
          </li>;
        })}
      </ul>}
      <PhotoDialog feedbackFields="photos" feedbackLabel="Fotos de la convocatoria" gallery={gallery} selected={photos.map(photo => photo.id)} disabled={!hasPhotoSpace || pending}
        maxUploadBytes={outingPhotoBatchMaxBytes - newPhotos.reduce((sum,photo) => sum + photo.file.size,0)}
        onSave={choice => {
          if (!hasPhotoSpace) return 'La convocatoria admite hasta seis fotos.';
          if (choice.kind === 'upload') setNewPhotos(current => [...current, { id: nextPhotoId.current++, file: choice.file, alt: choice.alt, credit: choice.credit }]);
          else if (choice.kind === 'gallery') setPhotos(current => [...current, { id: choice.id, alt: choice.alt, credit: choice.credit }]);
        }} />
      </fieldset>
    </fieldset>
    </section>

    <section className="new-outing-section" hidden={section!=='publication'}>
      <h2>Publicación</h2>
      <label>Visibilidad<select name="visibility" value={visibility} onChange={event => setVisibility(event.target.value)}>
      <option value="publica">Pública · visible en el catálogo</option>
      <option value="privada">Privada · solo por enlace directo</option>
    </select></label>
      <label>Fecha límite de inscripción
        <input type="date" name="registrationDeadline" value={deadline} onChange={event => setDeadline(event.target.value)} aria-describedby="registration-deadline-help" />
      </label>
      <p id="registration-deadline-help">Las inscripciones cierran al terminar ese día, hora de Costa Rica. Si dejás el campo vacío, cada bloque cierra el día de su llegada.</p>

      <section className="card" aria-labelledby="publication-summary">
        <h3 id="publication-summary">Resumen de publicación</h3>
        <dl className="profile-facts">
          <div><dt>Título</dt><dd>{title.trim() || 'Pendiente'}</dd></div>
          <div><dt>Unidad</dt><dd>{unit || 'Pendiente'}</dd></div>
          <div><dt>Visibilidad</dt><dd>{visibility === 'privada' ? 'Privada · solo por enlace directo' : 'Pública · visible en el catálogo'}</dd></div>
        </dl>
        <p aria-live="polite">Se {periods.length === 1 ? 'creará 1 bloque de fechas' : `crearán ${periods.length} bloques de fechas`}.</p>
        <ol className="profile-history">
          {periods.map(({ id, start, end }, index) => <li key={id}>
            <strong>Bloque {index + 1}</strong>
            <dl className="profile-facts">
              <div><dt>Llegada</dt><dd>{start ? start.split('-').reverse().join('/') : 'Pendiente'}</dd></div>
              <div><dt>Regreso</dt><dd>{end ? end.split('-').reverse().join('/') : 'Pendiente'}</dd></div>
              <div><dt>Cierre de inscripción</dt><dd>{deadline || start ? (deadline || start).split('-').reverse().join('/') : 'Pendiente'}</dd></div>
              <div><dt>Cupos</dt><dd>{capacity || 'Pendiente'}</dd></div>
            </dl>
          </li>)}
        </ol>
      </section>

      <div className="actions">
        <button disabled={pending} className="outing-draft" name="action" value="borrador">Guardar como borrador</button>
      </div>
    </section>
    </div>
    </fieldset></div></div>
    <CoordinationModal open={selector} onClose={()=>setSelector(false)} title="Sección de nueva convocatoria"><div className="editor-section-options">{editorSections.map(([key,label])=><button type="button" key={key} aria-pressed={section===key} onClick={()=>{setSection(key);setSelector(false);}}>{label}</button>)}</div></CoordinationModal>
    <CoordinationModal open={!!discard} onClose={()=>setDiscard(null)} title="Descartar convocatoria" footer={<button type="button" className="coord-button-danger" onClick={()=>{const href=discard||back;setDirty(false);setDiscard(null);router.push(href);}}>Descartar y salir</button>}><p>Los datos ingresados todavía no se guardaron. ¿Querés descartarlos?</p></CoordinationModal>
  </form></FormFeedbackProvider>;
}
