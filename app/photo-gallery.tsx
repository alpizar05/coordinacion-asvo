'use client';

import { useState } from 'react';

export function PhotoGallery({ photos, invitation }: { photos: { id: string; alt: string; credit: string }[]; invitation?: string }) {
  const [index, setIndex] = useState(0);
  const photo = photos[index] ?? photos[0];
  if (!photo) return null;

  return <figure className="photo-gallery" aria-label="Fotos de la convocatoria">
    <img src={`/api/fotos/${photo.id}${invitation ? `?invitacion=${encodeURIComponent(invitation)}` : ''}`} alt={photo.alt} />
    {photo.credit && <figcaption>Foto: {photo.credit}</figcaption>}
    {photos.length > 1 && <div className="photo-gallery-controls">
      <button type="button" aria-label="Foto anterior" disabled={index === 0}
        onClick={() => setIndex(index - 1)}><span aria-hidden="true">‹</span></button>
      <span role="status">{index + 1} / {photos.length}</span>
      <button type="button" aria-label="Foto siguiente" disabled={index >= photos.length - 1}
        onClick={() => setIndex(index + 1)}><span aria-hidden="true">›</span></button>
    </div>}
  </figure>;
}
