'use client';

import { StatusRibbon } from '../../../status-ribbon';

import { startTransition, useActionState, useRef, useState } from 'react';
import { attachOutingPhoto } from '../../../photo-actions';
import { outingPhotoMaxBytes } from '../../../../lib/outing-photo-limits';
import type { GalleryPhoto } from '../../../../lib/outing-photo-gallery';
import { OutingPhotoGallery } from '../../outing-photo-gallery';

export function AttachPhotos({ id, gallery }: { id: string; gallery: GalleryPhoto[] }) {
  const uploadForm = useRef<HTMLFormElement>(null);
  const [panel, setPanel] = useState<'gallery' | 'upload' | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [result, submit, pending] = useActionState(async (_previous: { error?: string; saved?: boolean }, form: FormData): Promise<{ error?: string; saved?: boolean }> => {
    const file = form.get('photo');
    if (file instanceof File && file.size > outingPhotoMaxBytes) return { error: 'Cada foto debe pesar como máximo 3 MB.' };
    try {
      const error = await attachOutingPhoto(id, form);
      if (error) return { error };
      const source = form.get('photoId');
      if (typeof source === 'string') setAdded(current => [...current, source]);
      else uploadForm.current?.reset();
      setPanel(null);
      return { saved: true };
    } catch {
      return { error: 'No se pudo agregar la foto. Intentá de nuevo.' };
    }
  }, {});

  return <>
    <div className="actions">
      <button type="button" disabled={pending} aria-expanded={panel === 'gallery'} aria-controls="edit-photo-gallery"
        onClick={() => setPanel(panel === 'gallery' ? null : 'gallery')}>Elegir de la galería</button>
      <button type="button" disabled={pending} aria-expanded={panel === 'upload'} aria-controls="edit-photo-upload"
        onClick={() => setPanel(panel === 'upload' ? null : 'upload')}>Subir una foto nueva</button>
    </div>
    <div id="edit-photo-gallery" hidden={panel !== 'gallery'}>
      {panel === 'gallery' && <OutingPhotoGallery gallery={gallery} selected={added} disabled={pending} onAdd={photo => {
        const form = new FormData();
        form.set('action', 'galeria');
        form.set('photoId', photo.id);
        startTransition(() => submit(form));
      }} />}
    </div>
    <div id="edit-photo-upload" hidden={panel !== 'upload'}>
    <form ref={uploadForm} method="post"
      onSubmit={event => {
        event.preventDefault();
        if (pending) return;
        const form = new FormData(event.currentTarget);
        form.set('action', 'agregar');
        startTransition(() => submit(form));
      }}>
        <label>Foto (JPG, PNG o WebP, hasta 3 MB)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required /></label>
        <label>Descripción de la foto<input name="alt" required maxLength={240} /></label>
        <label>Crédito de la foto<input name="credit" maxLength={150} /></label>
        <label><input type="checkbox" name="permission" required /> La foto está autorizada para publicación.</label>
        <button className="coord-button-primary" type="submit" disabled={pending}>Agregar foto</button>
    </form>
    </div>
    {pending && <p role="status">Agregando foto…</p>}
    {!pending && result.error && <p className="note" role="alert">{result.error}</p>}
    {!pending && result.saved && <StatusRibbon message="Foto agregada." />}
  </>;
}
