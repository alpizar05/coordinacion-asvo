import {outingIsOpen,registrationConsumesSeat} from './workflow-transitions';
import { audit,field,suggestedGroups,type Transaction } from './registration';
import { notifyRegistration,promoteWaitlist } from './registration-workflow';
import { validateSplitGroup } from './staff-registration-validation';
import type { FormResult } from './form-result';

export async function splitStaffGroup(tx:Transaction,id:string,start:string,end:string,form:FormData,context:{actor:string;canOperate:(unit:string)=>boolean}):Promise<FormResult & {id?:string}>{
  const members=form.getAll('member').map(String),title=field(form,'title'),capacity=Number(field(form,'capacity'));
    const [outing] = await tx`select * from outings where id=${id} for update`;
    if(!outing||!context.canOperate(outing.unit))return {error:'No tenés permiso para gestionar esta salida.'};
    if (!outing.flexible || !outingIsOpen(outing.status)) {
      return { error: 'La salida debe estar abierta o confirmada y tener fechas flexibles.' };
    }
    const entries = await tx<{ id: string; starts: string; ends: string; status: string }[]>`
      select id,starts::text,ends::text,status from registrations where outing_id=${id}
      and status in ('revisión','espera','confirmada') order by id for update`;
    const group = suggestedGroups(entries).find(group => group.starts === start && group.ends === end);
    const submitted = new Set(members);
    if (!group || group.people.length !== submitted.size || group.people.some(person => !submitted.has(person.id))) {
      return { error: 'La agrupación cambió. Revisá quiénes la integran antes de volver a separarla.' };
    }
    const occupied = group.people.filter(person => registrationConsumesSeat(person.status)).length;
    const fieldErrors=validateSplitGroup(form,occupied);
    if(Object.keys(fieldErrors).length)return {fieldErrors};

    const [created] = await tx<{ id: string }[]>`
      insert into outings (request_id,title,location,unit,starts,ends,flexible,capacity,requirements,logistics,transport_details,food_details,lodging_details,status,listed,registration_deadline,outing_overrides)
      values (${outing.request_id},${title},${outing.location},${outing.unit},${start},${end},true,${capacity},
        ${outing.requirements},${outing.logistics},${outing.transport_details},${outing.food_details},${outing.lodging_details},${outing.status},false,least(${start}::date,${outing.registration_deadline}::date),${Array.from(new Set([...outing.outing_overrides, 'title']))})
      returning id`;
    await tx`insert into outing_photos (outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
      select ${created.id},position,alt,credit,original_item,original_drive,thumbnail,display_image
      from outing_photos where outing_id=${id} and position is not null`;
    const ids = group.people.map(person => person.id);
    await tx`update registrations set outing_id=${created.id} where id=any(${ids}::uuid[])`;
    for (const registrationId of ids) {
      await audit(tx, context.actor, 'Trasladó inscripción a otra salida', registrationId, `Salida de origen: ${outing.title} (${id}) → ${title} (${created.id})`);
      await notifyRegistration(tx,registrationId,'Coordinación trasladó tu grupo a su propia salida. Conservás las fechas y el estado de tu inscripción.');
    }
    await promoteWaitlist(tx,id,context.actor);
    await promoteWaitlist(tx,created.id,context.actor);
    await audit(tx, context.actor, 'Separó agrupación', id, `Nueva salida: ${title} · ${ids.length} inscripciones`);
    await audit(tx, context.actor, 'Creó salida desde agrupación', created.id, `Salida original: ${id}`);
    return { saved:true, id: String(created.id) };
}
