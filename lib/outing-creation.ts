import type {StaffPrincipal} from './authorization';
import {canOperate} from './authorization';
import {requireStaff} from './auth';
import {field,uuid,date,audit,digest,type Transaction} from './registration';
import type {FieldErrors} from './form-result';
import type {PhotoReference} from './photo-upload-workflow';
import {validateNewOuting} from './outing-form-validation';
import {outingPhotoLimit,outingPhotoBatchMaxBytes} from './outing-photo-limits';
import {commonOutingFields} from './collection-fields';
import {outingLogisticsFields} from './outing-logistics';
import {saveGeneralPhotos} from './outing-inheritance';
import {newOutingTransition} from './workflow-transitions';
export class OutingCreationError extends Error {target?:string;fieldErrors?:FieldErrors;constructor(message:string,target?:string,fieldErrors?:FieldErrors){super(message);this.target=target;this.fieldErrors=fieldErrors;}}
export async function authorizeCreationPhotos(tx:Transaction,form:FormData,user:NonNullable<StaffPrincipal>){
 const unit=field(form,'unit');requireStaff(user,canOperate(user,unit));
 const selected=field(form,'request'),clone=field(form,'cloneBlock');
 if(uuid(selected)&&!canOperate(user)&&!(await tx`select 1 from outings where request_id=${selected} and unit=${unit}`).length)throw Error('Solicitud fuera de tu unidad.');
 if(clone){if(!uuid(clone))throw Error('El bloque de origen no está disponible.');const [source]=await tx`select unit,request_id from outings where id=${clone}`;if(!source||source.request_id!==selected||!canOperate(user,source.unit))throw Error('El bloque de origen no está disponible.');}
 const photos=form.getAll('copyPhoto').map(String);if(photos.some(id=>!uuid(id)))throw Error('Revisá la selección de fotos.');
 if(photos.length){const rows=await tx`select p.id,o.unit from outing_photos p join outings o on o.id=p.outing_id where p.id=any(${photos}::uuid[]) and p.position is not null`;if(photos.some(id=>!rows.some(p=>p.id===id&&canOperate(user,p.unit))))throw Error('Una foto ya no está disponible o no tenés permiso para usarla.');}
}
export async function saveOutingCreation(tx:Transaction,form:FormData,user:NonNullable<StaffPrincipal>,options:{preflightOnly?:boolean;expectedSnapshot?:string;uploads?:ReadonlyMap<string,PhotoReference>}={}):Promise<{snapshot:string;destination?:string}> {
  await authorizeCreationPhotos(tx,form,user);
  const unit = field(form,'unit');
  requireStaff(user,canOperate(user,unit));
  const fieldErrors=validateNewOuting(form);
  if(unit&&!(await tx`select 1 from units where name=${unit}`).length)fieldErrors.unit='Seleccioná una unidad disponible.';
  if(Object.keys(fieldErrors).length)throw new OutingCreationError('',undefined,fieldErrors);
  const starts = form.getAll('starts').map(String);
  const ends = form.getAll('ends').map(String);
  const periods = starts.map((start,index) => ({ start, end: ends[index] ?? '' }));
  const invalid = (message: string, target?: string): never => { throw new OutingCreationError(message, target); };
  if (!periods.length || periods.length > 24 || starts.length !== ends.length) {
    invalid('Ingresá entre 1 y 24 bloques con fechas válidas.', 'dates');
  }
  const ranges = new Set<string>();
  for (const [index, { start, end }] of periods.entries()) {
    const target = `period-${index}`;
    if (!date(start) || !date(end)) invalid('Completá las fechas de llegada y regreso.', target);
    if (end < start) invalid('El regreso debe ser el mismo día de la llegada o después.', target);
    const range = `${start}/${end}`;
    if (ranges.has(range)) invalid('Este rango ya está en otro bloque. Elegí fechas distintas.', target);
    ranges.add(range);
  }
  const capacity = Number(field(form,'capacity'));
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 10000) invalid('Ingresá entre 1 y 10 000 cupos.', 'capacity');
  if (outingLogisticsFields.some(item => field(form,item.name).length > 5000)) invalid('Usá hasta 5000 caracteres en cada campo de logística.', 'logistics');
  const title = field(form,'title'), location = field(form,'location');
  if (!title) invalid('Completá el título.', 'title');
  if (!location) invalid('Completá el lugar.', 'location');
  const publish = field(form,'action') === 'publicar';
  const listed = field(form,'visibility') !== 'privada';
  const deadline = field(form, 'registrationDeadline');
  if (deadline && (!date(deadline) || periods.some(period => deadline > period.start))) {
    invalid('La fecha límite debe ser el mismo día de la primera salida o anterior.', 'deadline');
  }
  const photoIds = form.getAll('copyPhoto').map(String);
  const uploads = Array.from({ length: outingPhotoLimit }, (_, index) => ({
    key: `new-${index}`,
    file: form.get(`photo-${index}`),
    alt: field(form, `alt-${index}`),
    credit: field(form, `credit-${index}`),
    permission: field(form, `permission-${index}`) === 'on',
  })).filter((photo): photo is typeof photo & { file: File } => photo.file instanceof File && photo.file.size > 0);
  if (photoIds.length + uploads.length > outingPhotoLimit ||
      new Set(photoIds).size !== photoIds.length || photoIds.some(id => !uuid(id))) {
    invalid('Revisá la selección. Podés incluir hasta seis fotos.', 'photos');
  }
  if (publish && !uploads.length && !photoIds.length) invalid('Adjuntá una portada para publicar la convocatoria.', 'photos');
  if (uploads.reduce((total, photo) => total + photo.file.size, 0) > outingPhotoBatchMaxBytes) {
    invalid('Las fotos nuevas deben pesar como máximo 3,75 MB en conjunto.', 'photos');
  }
  const order = [...photoIds, ...uploads.map(photo => photo.key)];
  const cover = field(form, 'photoCover');
  const coverIndex = order.indexOf(cover);
  if (coverIndex > 0) order.unshift(...order.splice(coverIndex, 1));
  const copiedPositions = photoIds.map(id => order.indexOf(id) + 1);
  for (const id of photoIds) {
    if ((form.has(`copyAlt-${id}`) && (!field(form,`copyAlt-${id}`) || field(form,`copyAlt-${id}`).length > 240)) || field(form,`copyCredit-${id}`).length > 150) invalid('Revisá descripción y crédito de la foto.',`existing-${id}`);
  }
  for(const photo of uploads)if(!photo.alt||photo.alt.length>240||photo.credit.length>150||!photo.permission)invalid('Completá la descripción y confirmá la autorización de la foto.',photo.key);
  const cloneId = field(form,'cloneBlock');
  if (cloneId && !uuid(cloneId)) invalid('El bloque de origen no está disponible.');

    const selected = field(form,'request');
    const [source] = cloneId ? await tx`select request_id,unit,outing_overrides from outings where id=${cloneId} for share` : [];
    if (cloneId && (!source || source.request_id !== selected || !canOperate(user,source.unit))) {
      invalid('El bloque de origen no está disponible.');
    }
    let requestId = selected;
    const values = { title, location, unit, requirements: field(form,'requirements'), logistics: field(form,'logistics') };
    const newRequest = !uuid(selected);
    if(!newRequest&&!(await tx`select 1 from outings where request_id=${selected} and unit=${unit}`).length&&!canOperate(user))throw new Error('Solicitud fuera de tu unidad.');
    let selectedPhotos:unknown=[];
    if (photoIds.length) {
      const matches = await tx<{ id: string; unit: string }[]>`select p.id,p.position,p.alt,p.credit,p.original_drive,p.original_item,o.unit
        from outing_photos p join outings o on o.id=p.outing_id
        where p.position is not null and p.id=any(${photoIds}::uuid[]) order by p.id
        for share of p,o`;
      selectedPhotos=matches;
      const unavailable = photoIds.find(id => !matches.some(photo => photo.id === id && canOperate(user, photo.unit)));
      if (unavailable) {
        invalid('Una foto seleccionada ya no está disponible o no tenés permiso para usarla. Revisá la galería.');
      }
    }
    const [general] = newRequest?[{outing_defaults:values}]:await tx`select outing_defaults,organization,contact,area,activity,plan,outing_photos_initialized from requests where id=${requestId} for update`;
    if(!general)invalid('La solicitud de apoyo ya no está disponible.');
    if (cloneId) {
      const existing = await tx`select starts::text,ends::text from outings where request_id=${requestId}`;
      const duplicate = periods.findIndex(period => existing.some(block => block.starts === period.start && block.ends === period.end));
      if (duplicate >= 0) invalid('Ya existe un bloque con estas fechas en la convocatoria general.', `period-${form.getAll('periodId')[duplicate]||duplicate}-starts`);
    }
    const snapshot=digest(JSON.stringify([selected,source??null,general,selectedPhotos]));
    if(options.preflightOnly)return {snapshot};
    if(options.expectedSnapshot!==snapshot)invalid('La solicitud o las fotos de origen cambiaron. Revisá los datos antes de guardar.');
    if(newRequest){
      const [request]=await tx`insert into requests(organization,contact,area,activity,plan,logistics,outing_defaults)values(${field(form,'organization')},${field(form,'contact')},${field(form,'area')},${field(form,'activity')},${field(form,'plan')},${field(form,'logistics')},${tx.json(values)})returning id`;requestId=request.id;
    }
    const newPhotos=uploads.map(photo=>{const image=options.uploads?.get(photo.key);if(!image)throw new OutingCreationError('No se encontró el archivo preparado.',photo.key);return {...photo,position:order.indexOf(photo.key)+1,original:{drive:image.drive,item:image.item},image};});
    const overrides = commonOutingFields.filter(item =>
      source?.outing_overrides.includes(item.name) || general.outing_defaults?.[item.name] !== values[item.name]
    ).map(item => item.name);
    const initialTransition=newOutingTransition(publish);
    const status=initialTransition.status;
    const created: string[] = [];
    for (const {start,end} of periods) {
      const [outing] = await tx`insert into outings(request_id,title,location,unit,starts,ends,flexible,capacity,requirements,logistics,transport_details,food_details,lodging_details,status,listed,registration_deadline,outing_overrides)
        values (${requestId},${title},${location},${unit},${start},${end},${field(form,'flexible') === 'on'},
        ${capacity},${field(form,'requirements')},${field(form,'logistics')},${field(form,'transport_details')},${field(form,'food_details')},${field(form,'lodging_details')},${status},${listed},${deadline || start},${newRequest ? [] : [...overrides, 'photos']}) returning id`;
      if (photoIds.length) {
        await tx`insert into outing_photos(outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
          select ${outing.id}::uuid,selection.position,
            photo.alt,photo.credit,photo.original_item,photo.original_drive,photo.thumbnail,photo.display_image
          from unnest(${photoIds}::uuid[], ${copiedPositions}::smallint[]) as selection(id,position)
          join outing_photos photo on photo.id=selection.id`;
        for (const sourceId of photoIds) {
          if (!form.has(`copyAlt-${sourceId}`) && !form.has(`copyCredit-${sourceId}`)) continue;
          await tx`update outing_photos set
            alt=coalesce(${form.has(`copyAlt-${sourceId}`) ? field(form,`copyAlt-${sourceId}`) : null}::text,alt),
            credit=coalesce(${form.has(`copyCredit-${sourceId}`) ? field(form,`copyCredit-${sourceId}`) : null}::text,credit)
            where outing_id=${outing.id} and position=${copiedPositions[photoIds.indexOf(sourceId)]}`;
        }
      }
      for (const { position, alt, credit, original, image } of newPhotos) {
        await tx`insert into outing_photos(outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
          values (${outing.id},${position},${alt},${credit},${original.item},${original.drive},${image.thumbnail},${image.display})`;
      }
      if (newRequest && !created.length) await saveGeneralPhotos(tx,requestId,outing.id);
      if (!newRequest && !source?.outing_overrides.includes('photos')) {
        await tx`update outings set outing_overrides=array_remove(outing_overrides,'photos') where id=${outing.id}
          and not exists (
            (select position,alt,credit,original_item,original_drive,thumbnail,display_image from outing_photos where outing_id=${outing.id} and position is not null
             except select position,alt,credit,original_item,original_drive,thumbnail,display_image from request_outing_photos where request_id=${requestId})
            union all
            (select position,alt,credit,original_item,original_drive,thumbnail,display_image from request_outing_photos where request_id=${requestId}
             except select position,alt,credit,original_item,original_drive,thumbnail,display_image from outing_photos where outing_id=${outing.id} and position is not null)
          )`;
      }
      await audit(tx,user.subject,initialTransition.audit,outing.id);
      created.push(outing.id);
    }
  const ids=created;
  if(cloneId)return {snapshot,destination:`/coordinacion/colecciones/automaticas/${field(form,'request')}?creados=${ids.length}#bloques`};
  return {snapshot,destination:ids.length===1?`/coordinacion/salidas/${ids[0]}?confirmacion=${publish?'creada':'borrador'}`:`/coordinacion/convocatorias?creadas=${ids.length}#salidas`};
}
