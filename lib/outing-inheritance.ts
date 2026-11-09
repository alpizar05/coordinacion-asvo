import type { Transaction } from './registration';

export async function saveGeneralPhotos(tx: Transaction, requestId: string, outingId: string) {
  await tx`delete from request_outing_photos where request_id=${requestId}`;
  await tx`insert into request_outing_photos
    select ${requestId},position,alt,credit,original_item,original_drive,thumbnail,display_image
    from outing_photos where outing_id=${outingId} and position is not null`;
  await tx`update requests set outing_photos_initialized=true where id=${requestId}`;
}

export async function inheritGeneralPhotos(tx: Transaction, requestId: string, outingId: string) {
  await tx`update outing_photos set position=null where outing_id=${outingId} and position is not null`;
  await tx`insert into outing_photos (outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
    select ${outingId},position,alt,credit,original_item,original_drive,thumbnail,display_image
    from request_outing_photos where request_id=${requestId}`;
}
