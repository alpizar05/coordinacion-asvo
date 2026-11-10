'use client';

import { useState } from 'react';
import { StatusRibbon } from '../../../status-ribbon';
import { attachOutingPhoto } from '../../../photo-actions';
import type { GalleryPhoto } from '../../../../lib/outing-photo-gallery';
import { PhotoDialog, type PhotoChoice } from '../../photo-dialog';

export function AttachPhotos({ id, gallery, initial }: {
  id: string; gallery: GalleryPhoto[]; initial?: { id: string; alt: string; credit: string };
}) {
  const [added,setAdded] = useState<string[]>([]);
  const [saved,setSaved] = useState('');
  async function save(photo: PhotoChoice) {
    const form = new FormData();
    form.set('alt',photo.alt); form.set('credit',photo.credit);
    if (photo.kind === 'upload') {
      form.set('action','agregar'); form.set('photo',photo.file); form.set('permission','on');
    } else {
      form.set('action',photo.kind === 'edit' ? 'editar' : 'galeria'); form.set('photoId',photo.id);
    }
    const error = await attachOutingPhoto(id,form);
    if (error) return error;
    if (photo.kind === 'gallery') setAdded(current => [...current,photo.id]);
    setSaved(initial ? 'Datos de foto actualizados.' : 'Foto agregada.');
  }
  return <><PhotoDialog gallery={gallery} selected={added}
    initial={initial ? { kind: 'edit',...initial } : undefined} onSave={save} />
    <StatusRibbon message={saved} onExpire={setSaved} /></>;
}
