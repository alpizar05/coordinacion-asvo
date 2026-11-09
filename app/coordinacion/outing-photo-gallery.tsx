'use client';

import { useState } from 'react';
import type { GalleryPhoto } from '../../lib/outing-photo-gallery';

export function OutingPhotoGallery({ gallery, selected = [], disabled, onAdd }: {
  gallery: GalleryPhoto[];
  selected?: string[];
  disabled: boolean;
  onAdd: (photo: GalleryPhoto) => void;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('es');
  const matches = gallery.filter(photo =>
    `${photo.alt} ${photo.title} ${photo.location}`.toLocaleLowerCase('es').includes(query)
  );

  return <>
    <label>Buscar por lugar, convocatoria o descripción
      <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
    </label>
    {!matches.length && <p>No hay fotos que coincidan con la búsqueda.</p>}
    {matches.length > 30 && <p>Se muestran 30 de {matches.length} fotos. Refiná la búsqueda para ver otras.</p>}
    <ul className="photo-admin-list">{matches.slice(0, 30).map(photo => {
      const added = selected.includes(photo.id);
      return <li key={photo.id}>
        <img src={`/api/fotos/${photo.id}?v=tarjeta`} alt={photo.alt} loading="lazy" />
        <div>
          <strong>{photo.alt}</strong>
          <p>{photo.location} · {photo.title}</p>
          <button type="button" disabled={added || disabled} onClick={() => onAdd(photo)}>
            {added ? 'Agregada' : 'Agregar a la convocatoria'}
          </button>
        </div>
      </li>;
    })}</ul>
  </>;
}
