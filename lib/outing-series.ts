import {outingSeriesVersion} from "./outing-editor";
import {type FormResult} from "./form-result";
import {allows, canOperate, requireStaff} from "./auth";
import {inheritGeneralPhotos, saveGeneralPhotos} from "./outing-inheritance";
import {registrationToday} from "./outing-invitations";
import {commonOutingFields} from "./collection-fields";
import {audit, field, outingIsEditable} from "./registration";
import {outingUnitHasConflict} from "./outing-unit-conflict";

export type ManualSeriesField='name'|'description'|'outing';
export type ManualSeriesSaveResult=FormResult<ManualSeriesField,{id:string}>;
export type ManualSeriesCreateResult=FormResult<ManualSeriesField,{destination:string}>;

export async function saveManualSeries(tx:import("./registration").Transaction,selected:string[],name:string,description:string,user:NonNullable<import("./authorization").StaffPrincipal>,general:boolean,scopes:string[]):Promise<ManualSeriesSaveResult>{
    const outings = await tx`select id from outings where id = any(${selected}::uuid[])
      and (${general} or unit = any(${scopes}::text[])) order by id for share`;
    if (outings.length !== selected.length) return {error:'Una de las salidas seleccionadas ya no está disponible para tu rol. Revisá la selección.'};
    const [collection] = await tx<{id:string}[]>`insert into outing_collections(name,description,created_by)
      values (${name},${description},${user.subject}) returning id`;
    await tx`insert into outing_collection_members(collection_id,outing_id)
      select ${collection.id}::uuid,id from unnest(${selected}::uuid[]) as members(id)`;
    await audit(tx, user.subject, 'Creó colección de salidas', collection.id);
    return {saved:true,id:collection.id};

}

export async function saveCommonSeries(tx:import("./registration").Transaction,id:string,form:FormData,user:NonNullable<import("./authorization").StaffPrincipal>):Promise<FormResult>{
  const selected = new Set(form.getAll('apply').map(String));
  const support = selected.has('support');
  const photos = selected.has('photos');
  const photoSource = field(form,'photoSource');
  const fields = commonOutingFields.filter(item => selected.has(item.name));
  const expected = new Set(form.getAll('block').map(String));
  const editableExpected = new Set(form.getAll('editableBlock').map(String));

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

}

export async function saveHomepageFeature(tx:import("./registration").Transaction,kind:"outing"|"request",id:string,user:import("./authorization").StaffPrincipal,clear:boolean):Promise<FormResult>{
    const blocks = await tx<{ unit: string; available: boolean }[]>`
      select unit,(status='abierta' and listed and coalesce(registration_deadline,starts) >= ${registrationToday}) as available
      from outings where ${kind === 'outing' ? tx`id=${id}` : tx`request_id=${id}`}
      order by id for share`;
    if(!user||!allows(user,'series.feature',{units:blocks.map(block=>block.unit)}))return {error:'No tenés permiso para destacar esta convocatoria.'};
    if (!clear && !blocks.some(block => block.available)) {
      return {error:'Solo podés destacar convocatorias públicas con inscripciones abiertas.'};
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
    return {saved:true};
}
