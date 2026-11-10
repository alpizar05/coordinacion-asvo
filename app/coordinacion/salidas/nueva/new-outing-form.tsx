'use client';

import { MobileDisclosure } from '../../mobile-disclosure';
import { FlexibleDatesHelp } from '../../flexible-dates-help';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOuting } from '../../../staff-actions';
import { outingPhotoBatchMaxBytes, outingPhotoLimit, outingPhotoMaxBytes } from '../../../../lib/outing-photo-limits';
import type { GalleryPhoto } from '../../../../lib/outing-photo-gallery';
import { PhotoDialog } from '../../photo-dialog';
import { OutingPeriods, type OutingPeriod } from '../../outing-periods';

export type OutingTemplate = {
  id: string; request_id: string; title: string; location: string; unit: string;
  starts: string; ends: string; flexible: boolean; capacity: number; listed: boolean;
  requirements: string | null; logistics: string | null; registration_deadline: string | null;
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
  const errorFocus = useRef<HTMLParagraphElement>(null);
  const [error, submit, pending] = useActionState(async (
    _previous: { message: string; target?: string } | null,
    { form, periodIds, photoIds }: { form: FormData; periodIds: number[]; photoIds: number[] },
  ) => {
    const files = photoIds.map((_, index) => form.get(`photo-${index}`));
    const invalidPhoto = files.findIndex(file => !(file instanceof File) || file.size === 0 || file.size > outingPhotoMaxBytes);
    if (invalidPhoto >= 0) {
      return { message: 'Elegí un archivo de imagen válido de hasta 3 MB.', target: `new-${photoIds[invalidPhoto]}` };
    }
    if (files.reduce((total, file) => total + (file instanceof File ? file.size : 0), 0) > outingPhotoBatchMaxBytes) {
      return { message: 'Las fotos nuevas deben pesar como máximo 3,75 MB en conjunto.', target: 'photos' };
    }
    try {
      const result = await createOuting(form);
      if (result.destination) {
        router.push(result.destination);
        return null;
      }
      let target = result.target;
      if (target?.startsWith('period-')) target = `period-${periodIds[Number(target.slice(7))]}`;
      if (target?.startsWith('new-')) target = `new-${photoIds[Number(target.slice(4))]}`;
      return { message: result.error || 'No se pudo crear la convocatoria.', target };
    } catch {
      return { message: 'No se pudo enviar la convocatoria. Intentá de nuevo.' };
    }
  }, null);
  useEffect(() => {
    if (error) errorFocus.current?.focus();
  }, [error]);
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

  function showError(target?: string) {
    if (!error || error.target !== target) return null;
    return <p className="note outing-field-error" role="alert" tabIndex={-1} ref={errorFocus}>{error.message}</p>;
  }

  return <form method="post" noValidate onSubmit={event => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    newPhotos.forEach((photo, index) => {
      form.set(`photo-${index}`, photo.file);
      form.set(`alt-${index}`, photo.alt);
      form.set(`credit-${index}`, photo.credit);
      form.set(`permission-${index}`, 'on');
    });
    const coverSlot = newPhotos.findIndex(photo => currentCover === photo.file);
    form.set('photoCover', coverSlot < 0 ? String(currentCover) : `new-${coverSlot}`);
    startTransition(() => submit({ form, periodIds: periods.map(period => period.id), photoIds: newPhotos.map(photo => photo.id) }));
  }}>
    <section className="new-outing-section">
    <h2>Datos de la salida</h2>
    {clone ? <>
      <input type="hidden" name="request" value={clone.request_id} />
      <input type="hidden" name="cloneBlock" value={clone.id} />
      <p>Basado en <strong>{clone.title}</strong>. Elegí las fechas del nuevo bloque y ajustá los datos si hace falta.</p>
    </> : <label>Copiar una convocatoria anterior (opcional)<select name="request" value={selected} onChange={event => {
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
      <option value="">Empezar desde cero</option>
      {templates.map(row => <option key={row.request_id} value={row.request_id}>
        {[row.organization, row.activity, row.title, row.starts].filter(Boolean).join(' · ')}
      </option>)}
    </select></label>}
    </section>
    <div key={selected} className="new-outing-fields">
    <section className="new-outing-section">
    <div className="grid"><div><label>Título<input name="title" value={title} onChange={event => setTitle(event.target.value)} required/></label>{showError('title')}</div><div><label>Estación o lugar<input name="location" defaultValue={template?.location} required/></label>{showError('location')}</div><label>Unidad<select name="unit" value={unit} onChange={event => setUnit(event.target.value)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label></div>
    </section>
    <section className="new-outing-section">
    <h2>Fechas y cupos</h2>
    {showError('dates')}
    <OutingPeriods limit={24} periods={periods} onChange={setPeriods} renderError={id => showError(`period-${id}`)} />
    <label>Cupos por bloque<input name="capacity" value={capacity} onChange={event => setCapacity(event.target.value)} type="number" min="1" max="10000" required /></label>
    {showError('capacity')}
    <FlexibleDatesHelp><label><input type="checkbox" name="flexible" defaultChecked={template?.flexible}/> Fechas flexibles</label></FlexibleDatesHelp>
    </section>
    <section className="new-outing-section">
    <h2>Información para voluntariado</h2>
    <label>Requisitos públicos<textarea name="requirements" defaultValue={template?.requirements ?? ""}/></label><label>Logística pública<textarea name="logistics" defaultValue={template?.logistics ?? ""} placeholder="Hospedaje, instalaciones, alimentación, transporte y herramientas"/></label>
    <fieldset>
      <legend>Fotos de la convocatoria</legend>
      {showError('photos')}
      <p>Elegí hasta seis fotos de la galería o de tu dispositivo y marcá cuál será la portada.</p>
      <p aria-live="polite"><strong>{photoCount} de {outingPhotoLimit} fotos</strong></p>
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
              {showError(`${item.kind}-${photo.id}`)}
              {isCover && <span className="outing-photo-cover">Portada</span>}
              <strong>{photo.alt || (item.kind === 'new' ? item.photo.file.name : '')}</strong>
              <PhotoDialog initial={item.kind === 'new'
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
      <PhotoDialog gallery={gallery} selected={photos.map(photo => photo.id)} disabled={!hasPhotoSpace || pending}
        maxUploadBytes={outingPhotoBatchMaxBytes - newPhotos.reduce((sum,photo) => sum + photo.file.size,0)}
        onSave={choice => {
          if (!hasPhotoSpace) return 'La convocatoria admite hasta seis fotos.';
          if (choice.kind === 'upload') setNewPhotos(current => [...current, { id: nextPhotoId.current++, file: choice.file, alt: choice.alt, credit: choice.credit }]);
          else if (choice.kind === 'gallery') setPhotos(current => [...current, { id: choice.id, alt: choice.alt, credit: choice.credit }]);
        }} />
    </fieldset>
    </section>
    <MobileDisclosure className="new-outing-section" title={`Solicitud de apoyo${template ? ` · ${template.organization || template.title}` : ''}`}>
    {template && <p>Los datos del pedido se muestran como referencia. Los datos de la salida se pueden editar.</p>}
    <div className="grid"><label>Organización solicitante<input name="organization" defaultValue={template?.organization ?? ""} readOnly={!!template}/></label><label>Contacto solicitante<input name="contact" defaultValue={template?.contact ?? ""} readOnly={!!template}/></label><label>Área silvestre protegida<input name="area" defaultValue={template?.area ?? ""} readOnly={!!template}/></label><label>Tipo de actividad<input name="activity" defaultValue={template?.activity ?? ""} readOnly={!!template}/></label></div>
    <label>Plan de trabajo<textarea name="plan" defaultValue={template?.plan ?? ""} readOnly={!!template}/></label>
    </MobileDisclosure>
    <section className="new-outing-section">
      <h2>Visibilidad y publicación</h2>
      <label>Visibilidad<select name="visibility" value={visibility} onChange={event => setVisibility(event.target.value)}>
      <option value="publica">Pública · visible en el catálogo</option>
      <option value="privada">Privada · solo por enlace directo</option>
    </select></label>
      <label>Fecha límite de inscripción
        <input type="date" name="registrationDeadline" value={deadline} onChange={event => setDeadline(event.target.value)} aria-describedby="registration-deadline-help" />
      </label>
      <p id="registration-deadline-help">Las inscripciones cierran al terminar ese día, hora de Costa Rica. Si dejás el campo vacío, cada bloque cierra el día de su llegada.</p>
      {showError('deadline')}
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
      {showError()}
      <div className="actions">
        <button className="coord-button-primary" disabled={pending} name="action" value="publicar">{pending ? "Guardando…" : clone ? "Publicar bloque" : "Publicar convocatoria"}</button>
        <button disabled={pending} className="outing-draft" name="action" value="borrador">Guardar como borrador</button>
      </div>
    </section>
    </div>
  </form>;
}
