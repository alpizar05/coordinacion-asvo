'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CoordinationModal } from './coordination-modal';
import { OutingPhotoGallery } from './outing-photo-gallery';
import type { GalleryPhoto } from '../../lib/outing-photo-gallery';
import { outingPhotoMaxBytes } from '../../lib/outing-photo-limits';

export type PhotoChoice = { alt: string; credit: string } & (
  { kind: 'upload'; file: File } | { kind: 'gallery'; id: string } | { kind: 'edit'; id: string }
);

export function PhotoPreview({ file, alt }: { file: File; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const value = URL.createObjectURL(file); setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return url ? <img className="photo-dialog-preview" src={url} alt={alt} /> : null;
}

export function PhotoDialog({ gallery = [], selected = [], initial, disabled = false, maxUploadBytes = outingPhotoMaxBytes, onSave }: {
  gallery?: GalleryPhoto[]; selected?: string[]; initial?: PhotoChoice; disabled?: boolean; maxUploadBytes?: number;
  onSave: (photo: PhotoChoice) => void | string | Promise<void | string>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'gallery' | 'upload'>('gallery');
  const [file, setFile] = useState<File | null>(null);
  const [photoId, setPhotoId] = useState('');
  const [alt, setAlt] = useState('');
  const [credit, setCredit] = useState('');
  const [permission, setPermission] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const id = useId();
  function fail(message: string) { setError(message); setTimeout(() => errorRef.current?.focus(),0); }
  async function save() {
    if (pending) return;
    if (!alt.trim()) return fail('Completá la descripción de la foto.');
    if (alt.trim().length > 240 || credit.trim().length > 150) return fail('Revisá la longitud de descripción y crédito.');
    let choice: PhotoChoice;
    if (initial?.kind === 'edit') choice = { kind: 'edit', id: initial.id, alt: alt.trim(), credit: credit.trim() };
    else if (mode === 'upload') {
      if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size) return fail('Elegí una foto JPG, PNG o WebP.');
      if (file.size > outingPhotoMaxBytes) return fail('La foto debe pesar como máximo 3 MB.');
      if (file.size > maxUploadBytes) return fail('Las fotos nuevas deben pesar como máximo 3,75 MB en conjunto.');
      if (!permission && !initial) return fail('Confirmá que la foto está autorizada para publicación.');
      choice = { kind: 'upload', file, alt: alt.trim(), credit: credit.trim() };
    } else {
      if (!photoId) return fail('Seleccioná una foto de la galería.');
      choice = { kind: 'gallery', id: photoId, alt: alt.trim(), credit: credit.trim() };
    }
    setPending(true); setError('');
    try {
      if (choice.kind === 'upload' && !initial) {
        const imageUrl = URL.createObjectURL(choice.file);
        try {
          const image = new Image(); image.src = imageUrl;
          await image.decode();
          if (image.naturalWidth * image.naturalHeight > 24_000_000) {
            fail('La foto debe tener como máximo 24 megapíxeles.'); return;
          }
        } catch { fail('No se pudo leer la imagen. Elegí una foto JPG, PNG o WebP válida.'); return; }
        finally { URL.revokeObjectURL(imageUrl); }
      }
      const result = await onSave(choice);
      if (result) fail(result);
      else { setDirty(false); setOpen(false); }
    } catch { fail('No se pudo agregar la foto. Tus datos se conservan para reintentar.'); }
    finally { setPending(false); }
  }
  return <>
    <button type="button" disabled={disabled} aria-haspopup="dialog" onClick={() => {
      setFile(initial?.kind === 'upload' ? initial.file : null);
      setPhotoId(initial && initial.kind !== 'upload' ? initial.id : '');
      setAlt(initial?.alt || ''); setCredit(initial?.credit || ''); setPermission(!!initial);
      setMode(initial?.kind === 'upload' || !gallery.length ? 'upload' : 'gallery');
      setError(''); setDirty(false); setOpen(true);
    }}>{initial ? 'Editar foto' : 'Agregar foto'}</button>
    <CoordinationModal open={open} onClose={() => setOpen(false)} title={initial ? 'Editar foto' : 'Agregar foto'}
      wide dirty={dirty} pending={pending} footer={<button type="button" className="coord-button-primary" disabled={pending} onClick={save}>
        {pending ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar foto'}</button>}>
      <div onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault(); }}>
      {error && <p ref={errorRef} tabIndex={-1} className="note" role="alert">{error}</p>}
      {!initial && <div className="photo-source-tabs" role="group" aria-label="Origen de la foto">
        <button type="button" aria-pressed={mode === 'gallery'} disabled={pending} onClick={() => { setMode('gallery'); setError(''); }}>Galería</button>
        <button type="button" aria-pressed={mode === 'upload'} disabled={pending} onClick={() => { setMode('upload'); setError(''); }}>Subir nueva</button>
      </div>}
      {open && !initial && mode === 'gallery' && !photoId && <OutingPhotoGallery gallery={gallery} selected={selected} disabled={pending}
        actionLabel="Seleccionar foto" onAdd={photo => {
          setPhotoId(photo.id); setAlt(photo.alt); setCredit(photo.credit || ''); setDirty(true);
        }} />}
      {!initial && mode === 'gallery' && photoId && <button type="button" disabled={pending} onClick={() => { setPhotoId(''); setDirty(true); }}>Elegir otra foto</button>}
      {!initial && mode === 'upload' && <label htmlFor={`${id}-file`}>Archivo · JPG, PNG o WebP, hasta 3 MB
        <input id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp" disabled={pending}
          onChange={event => { setFile(event.target.files?.[0] || null); setDirty(true); setError(''); }} />
      </label>}
      {open && (initial || (mode === 'upload' ? file : photoId)) && <fieldset disabled={pending} className="photo-dialog-fields">
        <legend>{initial ? 'Datos de la foto' : 'Foto seleccionada'}</legend>
        {mode === 'upload' && file ? <PhotoPreview file={file} alt={alt || file.name} />
          : <img className="photo-dialog-preview" src={`/api/fotos/${photoId}?v=tarjeta`} alt={alt || 'Foto seleccionada'} />}
        <label>Descripción de la foto<input value={alt} maxLength={240} onChange={event => { setAlt(event.target.value); setDirty(true); }} /></label>
        <label>Crédito de la foto<input value={credit} maxLength={150} onChange={event => { setCredit(event.target.value); setDirty(true); }} /></label>
        {mode === 'upload' && !initial && <label className="photo-permission"><input type="checkbox" checked={permission}
          onChange={event => { setPermission(event.target.checked); setDirty(true); }} />La foto está autorizada para publicación.</label>}
      </fieldset>}
      </div>
    </CoordinationModal>
  </>;
}
