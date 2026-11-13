'use server';
import {outingIsOpen,outingTransition,outingTransitionError,newOutingTransition} from '../lib/workflow-transitions';
import {applyOutingState} from '../lib/outing-state-transition';
import {outingSeriesVersion} from '../lib/outing-editor';
import {validateNewOuting,validateCommonSeries,validateManualSeries} from '../lib/outing-form-validation';
import type {FieldErrors} from '../lib/form-result';
import {prepareRegistryImport,applyRegistryImport} from '../lib/registry-import';
import {verifyRegistryPolicy,saveRegistryUnits,saveRegistryIncident,saveRegistryGrant} from '../lib/registry-mutations';

import { recoverRegistration, assignRegistration70, changeRegistrationStatus, dispatchRegistrationUpdates, occupiedSeats, promoteWaitlist } from '../lib/registration-workflow';

import { outingLogisticsFields } from '../lib/outing-logistics';
import { randomBytes } from 'node:crypto';
import { splitStaffGroup } from '../lib/staff-group';
import { validateProfile } from '../lib/profile-validation';
import type { ProfileField } from '../lib/profile-validation';
import type { FormResult } from '../lib/form-result';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { allows, canOperate, requireStaff, signIn, signOut, staff, staffScope } from '../lib/auth';
import { outingPhotoBatchMaxBytes, outingPhotoLimit } from '../lib/outing-photo-limits';
import { preparePhoto, storeOriginal } from '../lib/outing-photos';
import { inheritGeneralPhotos, saveGeneralPhotos } from '../lib/outing-inheritance';
import { registrationToday } from '../lib/outing-invitations';
import { commonOutingFields } from '../lib/collection-fields';
import { appUrl, demo, sql } from '../lib/db';
import { audit, date, digest, eligible, field, identification, outingIsEditable, suggestedGroups, uuid } from '../lib/registration';

export async function login(form: FormData) {
  if (demo) {
    const value = field(form,'role') === 'admin' ? 'admin' : 'general';
    (await cookies()).set('asvo-demo',value,{ httpOnly:true, sameSite:'lax', path:'/' });
    redirect('/coordinacion');
  }
  if (!process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.match(/^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0$/i)) {
    throw new Error('Configurá un directorio Entra específico.');
  }
  await signIn('microsoft-entra-id',{redirectTo:'/coordinacion'});
}

export async function logout() {
  if (demo) {
    (await cookies()).delete('asvo-demo');
    redirect('/');
  }
  await signOut({redirectTo:'/'});
}

export async function grant(form: FormData):Promise<FormResult> {
 const user=await staff();if(!user||!allows(user,'permissions.manage'))return {error:'No tenés permiso para administrar accesos.'};
 const result=await sql.begin(tx=>saveRegistryGrant(tx,form,user.subject,demo));
 if(result.saved)revalidatePath('/coordinacion/administracion');return result;
}

class OutingCreationError extends Error {
  constructor(message: string, readonly target?: string, readonly fieldErrors?:FieldErrors) {
    super(message);
  }
}

export async function createOuting(form: FormData): Promise<FormResult & {target?:string}> {
  try {
    return { saved:true,destination: await saveOuting(form) };
  } catch (error) {
    if (error instanceof OutingCreationError) return error.fieldErrors?{fieldErrors:error.fieldErrors}:{error:error.target?undefined:error.message,fieldErrors:error.target?{[error.target]:error.message}:undefined,target:error.target};
    console.error('Falló la creación de la convocatoria.', error);
    return { error: 'No se pudo crear la convocatoria. Revisá los datos e intentá de nuevo.' };
  }
}

async function saveOuting(form: FormData) {
  const user = await staff();
  const unit = field(form,'unit');
  requireStaff(user,canOperate(user,unit));
  const fieldErrors=validateNewOuting(form);
  if(unit&&!(await sql`select 1 from units where name=${unit}`).length)fieldErrors.unit='Seleccioná una unidad disponible.';
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
  const prepared: { key: string; alt: string; credit: string; position: number; image: Awaited<ReturnType<typeof preparePhoto>> }[] = [];
  const imageErrors:FieldErrors={};
  for (const photo of uploads) {
    const position = order.indexOf(photo.key) + 1;
    if (!photo.alt || photo.alt.length > 240 || photo.credit.length > 150 || !photo.permission) {
      invalid(`Completá la descripción y confirmá la autorización de la foto ${position}.`, photo.key);
    }
    try{const image=await preparePhoto(photo.file);prepared.push({...photo,image,position});}catch{imageErrors[`${photo.key}-photo`]=`Foto ${position}: el archivo no es una imagen JPG, PNG o WebP válida.`;}
  }
  if(Object.keys(imageErrors).length)throw new OutingCreationError('',undefined,imageErrors);
  const cloneId = field(form,'cloneBlock');
  if (cloneId && !uuid(cloneId)) invalid('El bloque de origen no está disponible.');
  const ids = await sql.begin(async tx => {
    const selected = field(form,'request');
    const [source] = cloneId ? await tx`select request_id,unit,outing_overrides from outings where id=${cloneId} for share` : [];
    if (cloneId && (!source || source.request_id !== selected || !canOperate(user,source.unit))) {
      invalid('El bloque de origen no está disponible.');
    }
    let requestId = selected;
    const values = { title, location, unit, requirements: field(form,'requirements'), logistics: field(form,'logistics') };
    const newRequest = !uuid(selected);
    if (newRequest) {
      const [request] = await tx`insert into requests(organization,contact,area,activity,plan,logistics,outing_defaults) values
        (${field(form,'organization')},${field(form,'contact')},${field(form,'area')},${field(form,'activity')},
        ${field(form,'plan')},${field(form,'logistics')},${tx.json(values)}) returning id`;
      requestId = request.id;
    } else if (!(await tx`select 1 from outings where request_id=${selected} and unit=${unit}`).length && !canOperate(user)) {
      throw new Error('Solicitud fuera de tu unidad.');
    }
    if (photoIds.length) {
      const matches = await tx<{ id: string; unit: string }[]>`select p.id,o.unit
        from outing_photos p join outings o on o.id=p.outing_id
        where p.position is not null and p.id=any(${photoIds}::uuid[])
        for share of p,o`;
      const unavailable = photoIds.find(id => !matches.some(photo => photo.id === id && canOperate(user, photo.unit)));
      if (unavailable) {
        invalid('Una foto seleccionada ya no está disponible o no tenés permiso para usarla. Revisá la galería.');
      }
    }
    const [general] = await tx`select outing_defaults from requests where id=${requestId} for update`;
    if (cloneId) {
      const existing = await tx`select starts::text,ends::text from outings where request_id=${requestId}`;
      const duplicate = periods.findIndex(period => existing.some(block => block.starts === period.start && block.ends === period.end));
      if (duplicate >= 0) invalid('Ya existe un bloque con estas fechas en la convocatoria general.', `period-${form.getAll('periodId')[duplicate]||duplicate}-starts`);
    }
    const newPhotos = [];
    for (const photo of prepared) {
      const original = await storeOriginal(photo.image).catch(() => invalid(`No se pudo guardar la foto ${photo.position} en SharePoint. Conservamos los archivos para reintentar.`));
      newPhotos.push({ ...photo, original });
    }
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
    return created;
  });
  if (cloneId) return `/coordinacion/colecciones/automaticas/${field(form,'request')}?creados=${ids.length}#bloques`;
  return ids.length === 1 ? `/coordinacion/salidas/${ids[0]}?confirmacion=${publish ? 'creada' : 'borrador'}` : `/coordinacion/convocatorias?creadas=${ids.length}#salidas`;
}

export async function manageOuting(id: string, form: FormData) {
  if (!uuid(id)) return;
  const user = await staff();
  const result = await sql.begin(async tx => {
    const [outing] = await tx`select *,starts::text as first_day,ends::text as last_day from outings where id=${id} for update`;
    requireStaff(user,!!outing && canOperate(user,outing.unit));
    if (!outingIsEditable(outing.status)) return 'Esta convocatoria está cerrada para edición.';
    const action = field(form,'action');
    const reason = field(form,'reason');
    if(!['completar','eliminar','cancelar-salida','datos','informacion','solicitud','visibilidad','fechas','publicar','cupo','agrupación','heredar-fotos'].includes(action))return 'La acción no está disponible.';
    if(action==='agrupación'&&!reason)return 'Indicá la decisión de coordinación.';
    if (action === 'completar') {
      if (!outingIsOpen(outing.status)) return 'Solo se puede completar una salida abierta o confirmada.';
      const [{ finished }] = await tx`select ${outing.last_day}::date < ${registrationToday} as finished`;
      const transition=outingTransition(outing.status,'completar',{finished});
      if('error' in transition)return outingTransitionError(transition.error,true);
      if (field(form,'confirmCompleted') !== 'on') return 'Confirmá que la actividad se realizó.';
      await applyOutingState(tx,id,user.subject,transition,reason,outing.title);
      return 'completada';
    }
    if (action === 'eliminar' || action === 'cancelar-salida') {
      const [registration] = await tx`select 1 from registrations where outing_id=${id} limit 1`;
      const transition=outingTransition(outing.status,action,{hasRegistrations:!!registration});
      if('error' in transition)return outingTransitionError(transition.error,true);
      if(action==='eliminar'){
        if(field(form,'confirmDelete')!=='on')return 'Confirmá que querés eliminar la convocatoria.';
        await applyOutingState(tx,id,user.subject,transition,reason,outing.title);
        return 'eliminada';
      }
      if(!reason)return 'Indicá el motivo de la cancelación.';
      await applyOutingState(tx,id,user.subject,transition,reason,outing.title);
    } else if (action === 'datos' || action === 'informacion') {
      const keys = action === 'datos' ? commonOutingFields.slice(0,3) : commonOutingFields.slice(3);
      const [request] = await tx`select outing_defaults from requests where id=${outing.request_id} for update`;
      const defaults = request.outing_defaults ?? outing;
      const personal = new Set(form.getAll('personal').map(String));
      const updates = Object.fromEntries(keys.map(item => [
        item.name, personal.has(item.name) ? field(form,item.name) : defaults[item.name] ?? '',
      ]));
      if (action === 'informacion') {
        for (const item of outingLogisticsFields) {
          if (field(form,item.name).length > 5000) return 'Usá hasta 5000 caracteres en cada campo de logística.';
          updates[item.name] = field(form,item.name);
        }
      }
      if (keys.some(item => item.required && !updates[item.name])) return 'Completá los campos obligatorios.';
      const unit = updates.unit;
      if (unit && unit !== outing.unit) {
        if (!canOperate(user, unit) || !(await tx`select 1 from units where name=${unit}`).length) {
          return 'Elegí una unidad que podás gestionar.';
        }
        if (unit !== 'Voluntariado General' && await outingUnitHasConflict(tx, [id], unit)) return 'unidad-incompatible';
      }
      const overrides = [
        ...outing.outing_overrides.filter((name: string) => !keys.some(item => item.name === name)),
        ...keys.filter(item => personal.has(item.name)).map(item => item.name),
      ];
      await tx`update outings set ${tx(updates)},outing_overrides=${overrides} where id=${id}`;
      await audit(tx,user.subject,'Actualizó excepciones del bloque',id);
    } else if (action === 'heredar-fotos') {
      const [request] = await tx`select outing_photos_initialized from requests where id=${outing.request_id} for update`;
      if (!request?.outing_photos_initialized) return 'La convocatoria general todavía no tiene fotos configuradas.';
      if (outing.status === 'abierta' && !(await tx`select 1 from request_outing_photos where request_id=${outing.request_id}`).length) {
        return 'La salida abierta necesita una portada.';
      }
      await inheritGeneralPhotos(tx,outing.request_id,id);
      await tx`update outings set outing_overrides=array_remove(outing_overrides,'photos') where id=${id}`;
      await audit(tx,user.subject,'Restauró fotos generales',id);
    } else if (action === 'solicitud') {
      await tx`select id from requests where id=${outing.request_id} for update`;
      const related = await tx`select id,unit from outings where request_id=${outing.request_id}`;
      if (related.some(block => !canOperate(user, block.unit))) return 'Solo quien gestiona todos los bloques puede editar esta solicitud compartida.';
      if (related.length > 1 && field(form,'confirmShared') !== 'on') return 'Confirmá el cambio para todos los bloques de esta solicitud.';
      await tx`update requests set organization=${field(form,'organization')},contact=${field(form,'contact')},
        area=${field(form,'area')},activity=${field(form,'activity')},plan=${field(form,'plan')}
        where id=${outing.request_id}`;
      await audit(tx,user.subject,'Actualizó solicitud de apoyo',outing.request_id);
    } else if (action === 'visibilidad') {
      const visibility = field(form,'visibility');
      if (!['publica','privada'].includes(visibility)) return;
      const listed = visibility === 'publica';
      const deadline = field(form, 'registrationDeadline');
      if (!date(deadline) || deadline > outing.first_day) return 'La fecha límite debe ser el mismo día de la salida o anterior.';
      await tx`update outings set listed=${listed},registration_deadline=${deadline} where id=${id}`;
      await audit(tx,user.subject,'Actualizó visibilidad y cierre de inscripción',id,`${listed ? 'Pública' : 'Privada por enlace'} · ${deadline}`);
    } else if (action === 'fechas') {
      const starts = field(form,'starts');
      const ends = field(form,'ends');
      const mode = field(form,'mode');
      const flexible = mode === 'flexible';
      if (!date(starts) || !date(ends) || starts > ends || !['fija','flexible'].includes(mode)) {
        return 'Revisá el rango de fechas y la modalidad.';
      }
      const [deadline] = await tx`select registration_deadline::text as value from outings where id=${id}`;
      if (deadline.value && deadline.value > starts) return 'Ajustá primero la fecha límite de inscripción en Visibilidad.';
      if (starts === outing.first_day && ends === outing.last_day && flexible === outing.flexible) return;
      if (!reason) return 'Indicá el motivo del cambio.';
      const [conflict] = await tx`select 1 from registrations
        where outing_id=${id} and status in ('validación','revisión','espera','confirmada')
        and (starts < ${starts}::date or ends > ${ends}::date
          or (not ${flexible}::boolean and (starts <> ${starts}::date or ends <> ${ends}::date)))
        limit 1`;
      if (conflict) return 'Hay inscripciones pendientes o activas con fechas incompatibles. Revisalas antes de cambiar la convocatoria.';
      await tx`update outings set starts=${starts},ends=${ends},flexible=${flexible} where id=${id}`;
      const previous = `${outing.first_day} a ${outing.last_day} (${outing.flexible ? 'flexible' : 'fija'})`;
      await audit(tx,user.subject,'Cambió fechas o modalidad',id,`${previous} → ${starts} a ${ends} (${mode}). ${reason}`);
    } else if (action === 'publicar' && outing.status === 'borrador') {
      const [cover] = await tx`select id from outing_photos where outing_id=${id} and position=1`;
      const transition=outingTransition(outing.status,'publicar',{hasCover:!!cover});
      if('error' in transition)return outingTransitionError(transition.error,true);
      await applyOutingState(tx,id,user.subject,transition,reason,outing.title);
    } else if (action === 'cupo') {
      if (!reason) return 'Indicá el motivo del ajuste de cupos.';
      const capacity = Number(field(form,'capacity'));
      const used = await occupiedSeats(tx,id);
      if (!Number.isSafeInteger(capacity) || capacity < Math.max(1,used) || capacity > 10000) return `Ingresá un cupo entre ${Math.max(1,used)} y 10 000.`;
      await tx`update outings set capacity=${capacity} where id=${id}`;
      await audit(tx,user.subject,'Cambió cupo',id,`${outing.capacity} → ${capacity}. ${reason}`);
      await promoteWaitlist(tx,id,user.subject);
    } else if (action === 'agrupación' && outing.flexible && reason) {
      await audit(tx,user.subject,'Decidió agrupación',id,reason);
    }
  });
  await dispatchRegistrationUpdates();
  if (result === 'eliminada') redirect('/coordinacion/convocatorias?confirmacion=eliminada#salidas');
  const back = `/coordinacion/salidas/${id}`;
  const action = field(form, 'action');
  if (result === 'completada') redirect(`${back}?completada=1`);
  if (action === 'agrupación') redirect(`${back}${result ? `?error=${encodeURIComponent(result)}` : '?confirmacion=agrupacion'}#agrupaciones`);
  if (!result && action === 'cancelar-salida') redirect(`${back}?confirmacion=cancelada`);
  const query = new URLSearchParams({ editar: '1' });
  if (!result) query.set('confirmacion','salida');
  if (result === 'unidad-incompatible') {
    query.set('error', 'El cambio de unidad afectaría inscripciones activas o pendientes.');
    query.set('unidadPropuesta', field(form, 'unit'));
  } else if (result) query.set('error', result);
  const terminalAction = ['eliminar', 'cancelar-salida'].includes(action);
  if (terminalAction && result) query.set('gestion', '1');
  const sections: Record<string, string> = {
    completar: '#completar-salida', datos: '#datos-salida', informacion: '#informacion-salida', solicitud: '#solicitud-apoyo',
    'heredar-fotos': '#fotos', fechas: '#fechas', cupo: '#cupos', visibilidad: '#visibilidad',
  };
  const anchor = terminalAction ? '#gestionar-salida' : sections[action] ?? (result ? '#fotos' : '');
  redirect(`${back}?${query}${anchor}`);
}

export async function splitOutingGroup(id: string, start: string, end: string, form: FormData): Promise<FormResult> {
  if (!uuid(id)) return {error:'La salida no está disponible.'};
  const user=await staff();
  if(!user)return {error:'No tenés permiso para gestionar esta salida.'};
  const result=await sql.begin(tx=>splitStaffGroup(tx,id,start,end,form,{actor:user.subject,canOperate:unit=>canOperate(user,unit)}));
  if(!result.saved)return result;
  await dispatchRegistrationUpdates();
  revalidatePath(`/coordinacion/salidas/${id}`);
  return {saved:true,destination:`/coordinacion/salidas/${id}?grupoCreado=${result.id}#agrupaciones`};
}

export async function manageEntry(id: string, fromList: boolean, filter: string, form: FormData) {
  if (!uuid(id)) return;
  const user = await staff();
  const action = field(form,'action');
  const reason = field(form,'reason');
  const result = await sql.begin(async tx => {
    const [ref] = await tx`select outing_id from registrations where id=${id}`;
    if (!ref) return;
    const [outing] = await tx`select *,starts::text as first_day,ends::text as last_day from outings where id=${ref.outing_id} for update`;
    requireStaff(user,canOperate(user,outing.unit));
    const [entry] = await tx`select *,starts::text as first_day,ends::text as last_day from registrations where id=${id} for update`;
    if (!entry || entry.outing_id !== outing.id) return {
      back: `/coordinacion/salidas/${outing.id}?error=${encodeURIComponent('La inscripción se trasladó a otra salida. Volvé a abrirla antes de gestionarla.')}`,
    };
    const summary = fromList && field(form,'fromSummary') === '1';
    const back = summary ? '/coordinacion' : fromList ? '/coordinacion/inscripciones' : `/coordinacion/salidas/${outing.id}`;
    const filters = new URLSearchParams(filter);
    const filterQuery = new URLSearchParams();
    if (fromList) {
      for (const key of (summary ? ['unidad','dias','pestana'] : ['estado','unidad','desde','hasta'])) {
        const value = filters.get(key);
        if (value) filterQuery.set(key,value);
      }
    }
    const previousFilters = filterQuery.size ? `&${filterQuery}` : '';
    if (fromList && !summary) filterQuery.set('estado','todos');
    const anchor = `#inscripcion-${id}`;
    filterQuery.set('gestionada', id);
    const success = `${back}?${filterQuery}${anchor}`;
    const fail = (message: string) => ({
      back: `${back}?inscripcion=${id}&error=${encodeURIComponent(message)}${previousFilters}${anchor}`,
    });
    if (!['abierta','confirmada'].includes(outing.status)) return fail('La salida debe estar abierta o confirmada.');
    if (action === 'asignar70' || action === 'quitar70') {
      const error = await assignRegistration70(tx,id,user.subject,action === 'asignar70');
      if (error) return fail(error);
    } else if (action === 'validar' && entry.status === 'validación') {
      const [person] = await tx`select id,email from volunteers where identification=${identification(field(form,'identification') || entry.identification)}`;
      if (!person?.email || !await eligible(tx,person.id,outing.unit)) return fail('Revisá la ficha, el correo y la unidad.');
      if ((await tx`select 1 from registrations where outing_id=${outing.id} and volunteer_id=${person.id}
        and status in ('revisión','espera','confirmada') and id<>${id}`).length) return fail('La persona ya tiene una inscripción activa.');
      await recoverRegistration(tx,id,{id:String(outing.id),capacity:Number(outing.capacity)},person.id,user.subject);
    } else {
      const error = await changeRegistrationStatus(tx,id,user.subject,action,reason,field(form,'approveDates'));
      if (error) return fail(error);
    }
    return { back: success };
  });
  await dispatchRegistrationUpdates();
  redirect(result?.back || '/coordinacion');
}

export async function verifyPolicy(form: FormData):Promise<FormResult> {
 const user=await staff();if(!user||!allows(user,'policies.verify'))return {error:'No tenés permiso para verificar pólizas.'};
 const id=field(form,'volunteer');if(!uuid(id))return {error:'La persona no está disponible.'};
 const result=await sql.begin(tx=>verifyRegistryPolicy(tx,id,form,user.subject));
 if(result.saved)revalidatePath(`/coordinacion/registro/${id}`);return result;
}

export async function importPreview(csv:string){
 const user=await staff();if(!user||!allows(user,'volunteers.import'))return {error:'No tenés permiso para importar voluntariado.'};
 return sql.begin(tx=>prepareRegistryImport(tx,csv,'volunteers'));
}
export async function applyImportRows(form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!allows(user,'volunteers.import'))return {error:'No tenés permiso para importar voluntariado.'};
 const result=await sql.begin(tx=>applyRegistryImport(tx,form,'volunteers',user.subject));
 if(result.saved){revalidatePath('/coordinacion/registro');revalidatePath('/coordinacion/administracion');}return result;
}

export async function editProfile(id: string, form: FormData): Promise<FormResult<ProfileField>> {
  const user = await staff();
  if (!user || !allows(user,'volunteers.correct')) return { error: 'No tenés permiso para corregir esta ficha.' };
  if (!uuid(id)) return { error: 'La persona no está disponible.' };
  const name = field(form,'name'), surname = field(form,'surname');
  const birth = field(form,'birth'), email = field(form,'email');
  const volunteerYear = field(form,'volunteer_year'), memberYear = field(form,'member_year');
  const boolean = (name: string) => {
    const value = field(form,name);
    return value === 'sí' ? true : value === 'no' ? false : null;
  };
  const member = boolean('member'), medical = boolean('medical');
  const fieldErrors = validateProfile(form);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const saved = await sql.begin(async tx => {
    const [updated] = await tx`update volunteers set name=${name},surname=${surname},second_surname=${field(form,'second_surname') || null},
      birth=${birth || null}, email=${email || null}, whatsapp=${field(form,'whatsapp') || null},
      province=${field(form,'province') || null},canton=${field(form,'canton') || null},district=${field(form,'district') || null},
      medical=${medical},medical_detail=${medical ? field(form,'medical_detail') : null},
      emergency_name=${field(form,'emergency_name') || null},emergency_phone=${field(form,'emergency_phone') || null},
      emergency_relation=${field(form,'emergency_relation') || null},volunteer_year=${volunteerYear || null},
      member=${member},member_year=${member ? memberYear || null : null} where id=${id} returning id`;
    if (!updated) return false;
    await audit(tx,user.subject,'Corrigió ficha',id);
    return true;
  });
  if (!saved) return { error: 'La persona ya no está disponible. Actualizá el registro antes de continuar.' };
  revalidatePath(`/coordinacion/registro/${id}`);
  return { saved: true };
}

export async function updateVolunteerUnits(id:string,form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!allows(user,'volunteers.units'))return {error:'No tenés permiso para actualizar unidades.'};
 if(!uuid(id))return {error:'La persona no está disponible.'};
 const result=await sql.begin(tx=>saveRegistryUnits(tx,id,form,user.subject));
 if(result.saved)revalidatePath(`/coordinacion/registro/${id}`);return result;
}

export async function previewPolicies(csv:string){
 const user=await staff();if(!user||!allows(user,'policies.import'))return {error:'No tenés permiso para importar pólizas.'};
 return sql.begin(tx=>prepareRegistryImport(tx,csv,'policies'));
}
export async function applyPolicyRows(form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!allows(user,'policies.import'))return {error:'No tenés permiso para importar pólizas.'};
 const result=await sql.begin(tx=>applyRegistryImport(tx,form,'policies',user.subject));
 if(result.saved){revalidatePath('/coordinacion/registro');revalidatePath('/coordinacion/administracion');}return result;
}

export async function recordVolunteerIncident(id:string,form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!allows(user,'volunteers.incident'))return {error:'No tenés permiso para registrar incidentes.'};
 if(!uuid(id))return {error:'La persona no está disponible.'};
 const result=await sql.begin(tx=>saveRegistryIncident(tx,id,form,user.subject));
 if(result.saved)revalidatePath(`/coordinacion/registro/${id}`);return result;
}

export async function createOutingCollection(_previous: FormResult, form: FormData):Promise<FormResult> {
  const user = await staff();
  const general = canOperate(user);
  const scopes = staffScope(user).units;
  requireStaff(user, general || scopes.length > 0);
  const name = field(form, 'name');
  const description = field(form, 'description');
  const selected = [...new Set(form.getAll('outing').map(String))];
  const errors=validateManualSeries(form);if(selected.some(id=>!uuid(id)))errors.outing='Seleccioná salidas válidas.';if(Object.keys(errors).length)return {fieldErrors:errors};

  const id = await sql.begin(async tx => {
    const outings = await tx`select id from outings where id = any(${selected}::uuid[])
      and (${general} or unit = any(${scopes}::text[])) order by id for share`;
    if (outings.length !== selected.length) return null;
    const [collection] = await tx`insert into outing_collections(name,description,created_by)
      values (${name},${description},${user.subject}) returning id`;
    await tx`insert into outing_collection_members(collection_id,outing_id)
      select ${collection.id}::uuid,id from unnest(${selected}::uuid[]) as members(id)`;
    await audit(tx, user.subject, 'Creó colección de salidas', collection.id);
    return collection.id;
  });
  if (!id) return {error:'Una de las salidas seleccionadas ya no está disponible para tu rol. Revisá la selección.'};
  return {saved:true,destination:`/coordinacion/colecciones/manuales/${id}?confirmacion=serie`};
}

export async function createOutingInvitation(id: string, _previous: FormResult & {link?:string}, form: FormData): Promise<FormResult & {link?:string}> {
  if (!uuid(id)) return { error: 'La convocatoria no está disponible.' };
  const user = await staff();
  const number = identification(field(form, 'identification'));
  if(!/^[A-Z0-9]{4,30}$/.test(number))return {fieldErrors:{identification:'Ingresá una identificación válida del registro.'}};
  const token = randomBytes(32).toString('base64url');
  const link = `${appUrl()}/convocatorias/${id}?invitacion=${token}`;
  return sql.begin(async tx => {
    const [outing] = await tx`select unit,status from outings where id=${id} for update`;
    requireStaff(user, !!outing && canOperate(user, outing.unit));
    if (!['abierta','confirmada'].includes(outing.status)) return { error: 'La salida debe estar abierta o confirmada.' };
    const [person] = await tx`select id,email from volunteers where identification=${number}`;
    if(!person)return {fieldErrors:{identification:'No encontramos esa identificación en el registro de voluntariado.'}};
    if (!person.email || !await eligible(tx, person.id, outing.unit)) {
      return { error: 'Revisá la identificación, el correo y la unidad de la persona voluntaria.' };
    }
    await tx`insert into outing_invitations(digest,outing_id,volunteer_id,expires_at)
      values (${digest(token)},${id},${person.id},now() + interval '7 days')`;
    await audit(tx, user.subject, 'Generó invitación a salida', id, person.id);
    return { saved:true,link };
  });
}

async function outingUnitHasConflict(tx: import('../lib/registration').Transaction, ids: string[], unit: string) {
  if (unit === 'Voluntariado General' || !ids.length) return false;
  const [conflict] = await tx`select 1 from registrations r left join volunteers v on v.id=r.volunteer_id
    where r.outing_id=any(${ids}::uuid[]) and r.status in ('validación','revisión','espera','confirmada')
    and (v.id is null or not (${unit}=any(v.units))) limit 1`;
  return !!conflict;
}

export async function updateAutomaticCollection(id: string, form: FormData) {
  const result=await saveAutomaticCollection(id,form);
  const back=`/coordinacion/colecciones/automaticas/${id}`;
  if(!result.saved)return result;
  redirect(`${back}?guardado=1`);
}

export async function saveAutomaticCollection(id: string, form: FormData): Promise<FormResult> {
  if (!uuid(id)) return {error:'Convocatoria inválida.'};
  const user = await staff();
  requireStaff(user, allows(user,'operations.read'));
  const validation=validateCommonSeries(form);if(Object.keys(validation).length)return {fieldErrors:validation};
  const back = `/coordinacion/colecciones/automaticas/${id}`;
  const selected = new Set(form.getAll('apply').map(String));
  const support = selected.has('support');
  const photos = selected.has('photos');
  const photoSource = field(form,'photoSource');
  const fields = commonOutingFields.filter(item => selected.has(item.name));
  const expected = new Set(form.getAll('block').map(String));
  const editableExpected = new Set(form.getAll('editableBlock').map(String));

  const outcome = await sql.begin(async (tx):Promise<FormResult> => {
    if ((!support && !photos && !fields.length) || field(form, 'confirm') !== 'on') {
      return {error:'Elegí qué datos querés actualizar y confirmá el cambio.'};
    }
    if (fields.some(item => item.required && !field(form, item.name))) {
      return {error:'Completá el título y el lugar si los seleccionaste para actualizar.'};
    }
    const [request] = await tx`select id from requests where id=${id} for update`;
    await tx`select id from outings where request_id=${id} order by id for update`;
    if (!request) return {error:'La solicitud de apoyo ya no está disponible.'};
    if(field(form,'version')!==await outingSeriesVersion(tx,id))return {error:'Los datos comunes o sus bloques cambiaron. Recargá antes de guardar.'};
    const blocks = await tx<{ id: string; unit: string; status: string; outing_overrides: string[] }[]>`
      select id,unit,status,outing_overrides from outings where request_id=${id}`;
    if (!allows(user,'series.common-edit',{units:blocks.map(block=>block.unit)})) {
      return {error:'Necesitás permiso para gestionar todos los bloques.'};
    }
    const editable = blocks.filter(block => outingIsEditable(block.status));
    if (expected.size !== blocks.length || blocks.some(block => !expected.has(block.id)) ||
        editableExpected.size !== editable.length || editable.some(block => !editableExpected.has(block.id))) {
      return {error:'Los bloques cambiaron. Revisá la lista antes de guardar.'};
    }
    if (fields.length && !editable.length) return {error:'No hay bloques abiertos para editar sus datos.'};
    const unit = fields.some(item => item.name === 'unit') ? field(form,'unit') : '';
    if (unit) {
      if(!canOperate(user,unit))return {error:'No tenés permiso para gestionar la unidad seleccionada.'};
      if(!(await tx`select 1 from units where name=${unit}`).length)return {fieldErrors:{unit:'Seleccioná una unidad disponible.'}};
      const inheriting = editable.filter(block => !block.outing_overrides.includes('unit') && block.unit !== unit);
      if (await outingUnitHasConflict(tx,inheriting.map(block => block.id),unit)) {
        return {error:'El cambio de unidad afectaría inscripciones activas o pendientes en un bloque que hereda la unidad.'};
      }
    }
    if(photos&&!blocks.some(block=>block.id===photoSource))return {fieldErrors:{photoSource:'Elegí un bloque de esta serie con portada.'}};
    if(photos&&!(await tx`select 1 from outing_photos where outing_id=${photoSource} and position=1`).length)return {error:'La portada del bloque seleccionado ya no está disponible. Actualizá la serie.'};
    if (support) {
      await tx`update requests set organization=${field(form,'organization')},contact=${field(form,'contact')},
        area=${field(form,'area')},activity=${field(form,'activity')},plan=${field(form,'plan')} where id=${id}`;
      await audit(tx,user.subject,'Actualizó solicitud de apoyo',id);
    }
    if (fields.length) {
      const updates = Object.fromEntries(fields.map(item => [item.name, field(form, item.name)]));
      await tx`update requests set outing_defaults=coalesce(outing_defaults,'{}'::jsonb) || ${tx.json(updates)} where id=${id}`;
      for (const item of fields) {
        const inheriting = editable.filter(block => !block.outing_overrides.includes(item.name));
        await tx`update outings set ${tx({ [item.name]: updates[item.name] })}
          where id=any(${inheriting.map(block => block.id)}::uuid[])`;
      }
      await audit(tx,user.subject,'Actualizó datos generales de convocatoria',id,fields.map(item => item.label).join(', '));
    }
    if (photos) {
      await saveGeneralPhotos(tx,id,photoSource);
      for (const block of editable.filter(block => !block.outing_overrides.includes('photos'))) {
        await inheritGeneralPhotos(tx,id,block.id);
      }
      await audit(tx,user.subject,'Actualizó fotos generales de convocatoria',id);
    }
    return {saved:true};
  });
  if (!outcome.saved) return outcome;
  revalidatePath(back); revalidatePath(`/colecciones/${id}`); revalidatePath('/');
  return {saved:true};
}

export async function setHomepageFeature(kind: 'outing' | 'request', id: string, form: FormData) {
  if (!uuid(id) || !['outing','request'].includes(kind)) return;
  const user = await staff();
  const clear = field(form,'action') === 'retirar';
  const back = kind === 'outing' ? `/coordinacion/salidas/${id}` : `/coordinacion/colecciones/automaticas/${id}`;
  const error = await sql.begin(async tx => {
    const blocks = await tx<{ unit: string; available: boolean }[]>`
      select unit,(status='abierta' and listed and coalesce(registration_deadline,starts) >= ${registrationToday}) as available
      from outings where ${kind === 'outing' ? tx`id=${id}` : tx`request_id=${id}`}
      order by id for share`;
    requireStaff(user, allows(user,'series.feature',{units:blocks.map(block=>block.unit)}));
    if (!clear && !blocks.some(block => block.available)) {
      return 'Solo podés destacar convocatorias públicas con inscripciones abiertas.';
    }
    if (clear) {
      const removed = await tx`delete from homepage_feature
        where singleton and ${kind === 'outing' ? tx`outing_id=${id}` : tx`request_id=${id}`}
        returning singleton`;
      if (removed.length) await audit(tx,user.subject,'Retiró convocatoria destacada',id);
    } else {
      await tx`insert into homepage_feature(singleton,outing_id,request_id)
        values (true,${kind === 'outing' ? id : null},${kind === 'request' ? id : null})
        on conflict (singleton) do update set outing_id=excluded.outing_id,request_id=excluded.request_id`;
      await audit(tx,user.subject,'Destacó convocatoria en portada',id);
    }
  });
  if (!error) revalidatePath('/');
  redirect(`${back}${error ? `?destacadaError=${encodeURIComponent(error)}` : `?confirmacion=${field(form,'action') === 'retirar' ? 'automatica' : 'destacada'}`}#destacada`);
}
