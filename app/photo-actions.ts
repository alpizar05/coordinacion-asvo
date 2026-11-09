'use server';

import { revalidatePath } from 'next/cache';
import { outingPhotoLimit } from '../lib/outing-photo-limits';
import { redirect } from 'next/navigation';
import { canOperate, requireStaff, staff } from '../lib/auth';
import { sql } from '../lib/db';
import { preparePhoto, storeOriginal } from '../lib/outing-photos';
import { audit, field, outingIsEditable, uuid } from '../lib/registration';

export async function managePhoto(id: string, form: FormData) {
  const error = await updatePhoto(id, form);
  const back = `/coordinacion/salidas/${id}`;
  redirect(error ? `${back}?editar=1&error=${encodeURIComponent(error)}#fotos` : `${back}?editar=1#fotos`);
}

export async function attachOutingPhoto(id: string, form: FormData) {
  if (!['agregar', 'galeria'].includes(field(form, 'action'))) return 'Elegí cómo agregar la foto.';
  const error = await updatePhoto(id, form);
  if (!error) {
    revalidatePath(`/coordinacion/salidas/${id}`);
    revalidatePath(`/convocatorias/${id}`);
  }
  return error;
}

async function updatePhoto(id: string, form: FormData) {
  if (!uuid(id)) return 'La convocatoria no está disponible.';
  const user = await staff();
  const [ref] = await sql`select unit from outings where id=${id}`;
  requireStaff(user,!!ref && canOperate(user,ref.unit));
  const action = field(form,'action');
  const photoId = field(form,'photoId');
  let error: string | undefined;
  try {
    const alt = field(form,'alt');
    const credit = field(form,'credit');
    const file = form.get('photo');
    if (action === 'agregar' && (!(file instanceof File) || !alt || alt.length > 240 || credit.length > 150)) {
      throw new Error('Elegí una foto y completá su descripción.');
    }
    if (action === 'agregar' && field(form,'permission') !== 'on') {
      throw new Error('Agregá únicamente fotos autorizadas para publicación.');
    }
    const prepared = action === 'agregar' && file instanceof File ? await preparePhoto(file) : null;
    await sql.begin(async tx => {
      const [outing] = await tx`select unit,status from outings where id=${id} for update`;
      requireStaff(user,!!outing && canOperate(user,outing.unit));
      if (!outingIsEditable(outing.status)) {
        error = 'Esta convocatoria está cerrada para edición.';
        return;
      }
      const markPersonal = () => tx`update outings set outing_overrides=array_append(outing_overrides,'photos')
        where id=${id} and not ('photos'=any(outing_overrides))`;
      const photos = await tx`select id,position from outing_photos where outing_id=${id} and position is not null order by position`;
      if ((prepared || action === 'galeria') && photos.length >= outingPhotoLimit) {
        throw new Error('La convocatoria admite hasta seis fotos.');
      }
      if (action === 'galeria') {
        if (!uuid(photoId)) throw new Error('Elegí una foto disponible de la galería.');
        const [source] = await tx`select p.id,o.unit
          from outing_photos p join outings o on o.id=p.outing_id
          where p.id=${photoId} and p.position is not null and p.outing_id<>${id}
          for share of p`;
        if (!source || !canOperate(user, source.unit)) throw new Error('Elegí una foto disponible de la galería.');
        const [photo] = await tx`insert into outing_photos
          (outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
          select ${id},${photos.length + 1},alt,credit,original_item,original_drive,thumbnail,display_image
          from outing_photos where id=${source.id} returning id`;
        await markPersonal();
        await audit(tx, user.subject, 'Adjuntó foto de la galería', photo.id);
        return;
      }
      if (prepared) {
        const original = await storeOriginal(prepared);
        const [photo] = await tx`insert into outing_photos(outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
          values (${id},${photos.length + 1},${alt},${credit},${original.item},${original.drive},
            ${prepared.thumbnail},${prepared.display}) returning id`;
        await markPersonal();
        await audit(tx,user.subject,'Adjuntó foto',photo.id);
        return;
      }
      const index = photos.findIndex(photo => photo.id === photoId);
      if (index < 0) return;
      if (action === 'retirar') {
        if (outing.status === 'abierta' && photos.length === 1) throw new Error('Agregá otra foto antes de retirar la única portada.');
        await tx`update outing_photos set position=null where id=${photoId}`;
        await tx`update outing_photos set position=position-1 where outing_id=${id} and position>${index+1}`;
        await markPersonal();
        await audit(tx,user.subject,'Retiró foto',photoId);
        return;
      }
      const target = photos[action === 'portada' ? 0 : action === 'subir' ? index-1 : action === 'bajar' ? index+1 : -1];
      if (!target || target.id === photoId) return;
      await tx`update outing_photos set position=case when id=${photoId} then ${target.position}::smallint else ${index+1}::smallint end
        where id in (${photoId},${target.id})`;
      await markPersonal();
      await audit(tx,user.subject,'Reordenó foto',photoId);
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '';
    error = /^(Elegí|Usá|La convocatoria|Configurá|No se pudo|SharePoint|Agregá)/.test(message)
      ? message : 'No se pudo procesar la foto.';
  }
  return error;
}
