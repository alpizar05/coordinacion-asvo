import {outingIsOpen,registrationStaffMutable,registrationCanReopen,staffRegistrationTransition,reservationTransition,promotionTransition,assign70Transition} from './workflow-transitions';
import { appUrl, demo, sql } from './db';
import { audit, hours, type Transaction } from './registration';
import { queueRegistrationMail } from './registration-mail.mjs';
import { flushRegistrationMail } from './mail-outbox.mjs';

export async function occupiedSeats(tx: Transaction, outingId: string) {
  const [{ used }] = await tx<{ used: number }[]>`select count(*)::int as used from registrations
    where outing_id=${outingId} and status in ('revisión','confirmada')`;
  return used;
}

export function notifyRegistration(tx: Transaction, id: string, message: string) {
  return queueRegistrationMail(tx,id,message,{ origin: appUrl(), demo, managementHours: hours('MANAGEMENT_HOURS',72) });
}

// The caller holds the outing row lock for the whole reservation and notification transaction.
export async function promoteWaitlist(tx: Transaction, outingId: string, actor: string, exclude: string[] = []) {
  const [outing] = await tx`select capacity,status from outings where id=${outingId}`;
  if (!outing || !outingIsOpen(outing.status)) return;
  const free = Math.max(0, outing.capacity - await occupiedSeats(tx, outingId));
  if (!free) return;
  const waiting = await tx<{ id: string }[]>`select id from registrations where outing_id=${outingId}
    and status='espera' and not (id=any(${exclude}::uuid[])) order by received_at,id limit ${free} for update`;
  for (const entry of waiting) {
    await tx`update registrations set status=${promotionTransition.status} where id=${entry.id}`;
    await audit(tx,actor,promotionTransition.audit,entry.id);
    await notifyRegistration(tx,entry.id,promotionTransition.message);
  }
}

export async function dispatchRegistrationUpdates() {
  if (demo) return;
  try { await flushRegistrationMail(sql); }
  catch { console.error('Los correos de inscripción siguen pendientes de envío.'); }
}

export async function assignRegistration70(tx: Transaction, id: string, actor: string, assigned: boolean) {
  const [entry] = await tx`select r.status,o.status as outing_status from registrations r
    join outings o on o.id=r.outing_id where r.id=${id}`;
  const decision=assign70Transition(entry?.status??'',entry?.outing_status??'',assigned);
  if('error' in decision)return decision.error;
  await tx`update registrations set details=jsonb_set(coalesce(details,'{}'::jsonb),'{assigned70}',${tx.json(assigned)}::jsonb) where id=${id}`;
  if (!assigned) await tx`update outing_brief_links set revoked_at=now() where lead_registration_id=${id} and revoked_at is null`;
  await audit(tx,actor,decision.audit,id);
  await notifyRegistration(tx,id,decision.message);
}

// Caller holds the outing lock; adapter versions are checked under that same lock.
export async function changeRegistrationStatus(tx: Transaction, id: string, actor: string, action: string, reason: string, approveDates: string) {
  const [entry] = await tx`select *,starts::text as first_day,ends::text as last_day from registrations where id=${id}`;
  const reopening = entry && registrationCanReopen(entry.status,action);
  if (!entry || !registrationStaffMutable(entry.status,action)) return 'Esta inscripción ya no está activa.';
  const [outing] = await tx`select *,starts::text as first_day,ends::text as last_day from outings where id=${entry.outing_id}`;
  if (!outing || !outingIsOpen(outing.status)) return 'La salida debe estar abierta o confirmada.';
  const decision=staffRegistrationTransition(entry.status,outing.status,action,reason);
  if('error' in decision)return decision.error;
  if(action==='confirmar'){
    const outside = entry.first_day < outing.first_day || entry.last_day > outing.last_day;
    if (outside && (!outing.flexible || approveDates !== `${entry.first_day}/${entry.last_day}`)) {
      return 'Revisá y aprobá las fechas fuera del rango publicado.';
    }
    if (reopening) {
      if ((await tx`select 1 from registrations where outing_id=${outing.id} and volunteer_id=${entry.volunteer_id}
        and id<>${id} and status in ('validación','revisión','espera','confirmada')`).length) return 'La persona ya tiene otra inscripción activa en esta salida.';
      await promoteWaitlist(tx,outing.id,actor);
    }
    if ((entry.status === 'espera' || reopening) && await occupiedSeats(tx,outing.id) >= outing.capacity) return 'Todos los cupos están ocupados.';
    const [person] = await tx`select units from volunteers where id=${entry.volunteer_id}`;
    if (!person || (outing.unit !== 'Voluntariado General' && !person.units.includes(outing.unit))) return 'La ficha no pertenece a la unidad requerida.';
    const [policy] = await tx`select id from policies where volunteer_id=${entry.volunteer_id} and verified_at is not null
      and starts<=${entry.first_day}::date and ends>=${entry.last_day}::date order by verified_at desc limit 1`;
    if (!policy) return 'Falta una póliza vigente para todo el periodo.';
    await tx`update registrations set status=${decision.status},policy_id=${policy.id},details=case when ${!!reopening} then details-'assigned70' else details end where id=${id}`;
    await audit(tx,actor,decision.audit,id);
    if (outside) await audit(tx,actor,'Aprobó fechas fuera del rango',id,`${entry.first_day} al ${entry.last_day}`);
    await notifyRegistration(tx,id,decision.message);
    return;
  }
  const status=decision.status;
  await tx`update registrations set status=${status},details=details-'assigned70' where id=${id}`;
  await tx`update outing_brief_links set revoked_at=now() where lead_registration_id=${id} and revoked_at is null`;
  await audit(tx,actor,decision.audit,id,reason);
  await notifyRegistration(tx,id,decision.message);
  await promoteWaitlist(tx,outing.id,actor,action === 'espera' ? [id] : []);
}

export async function receiveRegistration(tx: Transaction, input: {
  outingId: string;
  volunteerId: string;
  actor?: string;
  identification: string;
  starts: string;
  ends: string;
  details: Record<string,string | boolean | number>;
}) {
  const { outingId, volunteerId, identification, starts, ends, details } = input;
  const [outing] = await tx`select capacity from outings where id=${outingId}`;
  const [existing] = await tx`select id from registrations where outing_id=${outingId} and volunteer_id=${volunteerId}
    and status in ('validación','revisión','espera','confirmada') limit 1`;
  if (existing) return { duplicate: true as const };
  await promoteWaitlist(tx,outingId,'sistema');
  const decision=reservationTransition(await occupiedSeats(tx,outingId),outing.capacity);
  const status=decision.status;
  const [entry] = await tx<{ id: string }[]>`insert into registrations
    (outing_id,volunteer_id,identification,starts,ends,details,status)
    values (${outingId},${volunteerId},${identification},${starts},${ends},${tx.json(details)},${status}) returning id`;
  await audit(tx,input.actor || 'voluntariado',decision.audit,entry.id,status);
  await notifyRegistration(tx,entry.id,decision.message);
  return { id: entry.id, status };
}

/** Caller has locked the outing/entry and checked identity, eligibility and duplicates. */
export async function recoverRegistration(tx:Transaction,id:string,outing:{id:string;capacity:number},personId:string,actor:string){
 await promoteWaitlist(tx,outing.id,actor);
 const decision=reservationTransition(await occupiedSeats(tx,outing.id),outing.capacity,'recovered');
 await tx`update registrations set volunteer_id=${personId},status=${decision.status} where id=${id}`;
 await audit(tx,actor,decision.audit,id);
 await notifyRegistration(tx,id,decision.message);
}
