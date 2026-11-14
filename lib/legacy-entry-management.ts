import {registrationCanReopen} from './workflow-transitions';
import type {FieldErrors} from './form-result';
import {validateEntryManagement} from './staff-registration-validation';
import type {LegacyEntryResult} from './legacy-operation-result';
import {recoverRegistration, assignRegistration70, changeRegistrationStatus} from "./registration-workflow";
import {canOperate} from "./auth";
import {eligible, field, identification} from "./registration";

export async function manageLegacyEntry(tx:import("./registration").Transaction,id:string,fromList:boolean,filter:string,form:FormData,user:import("./authorization").StaffPrincipal):Promise<LegacyEntryResult>{
 const action=field(form,"action"),reason=field(form,"reason");
    const [ref] = await tx`select outing_id from registrations where id=${id}`;
    if (!ref) return {error:'La inscripción ya no está disponible.',back:'/coordinacion/inscripciones?error='+encodeURIComponent('La inscripción ya no está disponible.')};
    const [outing] = await tx`select *,starts::text as first_day,ends::text as last_day from outings where id=${ref.outing_id} for update`;
    if(!user||!outing||!canOperate(user,outing.unit))return {error:'No tenés permiso para gestionar esta inscripción.',back:'/coordinacion/inscripciones?error='+encodeURIComponent('No tenés permiso para gestionar esta inscripción.')};
    const [entry] = await tx`select *,starts::text as first_day,ends::text as last_day from registrations where id=${id} for update`;
    if (!entry || entry.outing_id !== outing.id) return {
      error:'La inscripción se trasladó a otra salida. Volvé a abrirla antes de gestionarla.',
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
    const fail = (message: string,fieldErrors?:FieldErrors):LegacyEntryResult => ({error:message,fieldErrors,
      back: `${back}?inscripcion=${id}&error=${encodeURIComponent(message)}${previousFilters}${anchor}`,
    });
    const approval=outing.flexible&&(entry.first_day<outing.first_day||entry.last_day>outing.last_day)?`${entry.first_day}/${entry.last_day}`:undefined;
    const decisionFailure=(message:string):LegacyEntryResult=>{
      const errors=validateEntryManagement(form,action,approval);
      const result=fail(message,Object.keys(errors).length?errors:undefined);
      // The historical reopen path can reserve a FIFO seat even when the requested reopen fails.
      return registrationCanReopen(entry.status,action)&&!Object.keys(errors).length?{...result,flushUpdates:true}:result;
    };
    if (!['abierta','confirmada'].includes(outing.status)) return fail('La salida debe estar abierta o confirmada.');
    if (action === 'asignar70' || action === 'quitar70') {
      const result = await assignRegistration70(tx,id,user.subject,action === 'asignar70');
      if (result.saved !== true) return decisionFailure(result.error || 'No se pudo confirmar la gestión de la inscripción.');
    } else if (action === 'validar' && entry.status === 'validación') {
      const [person] = await tx`select id,email from volunteers where identification=${identification(field(form,'identification') || entry.identification)}`;
      if(!person)return fail('Revisá la ficha, el correo y la unidad.',{identification:'No encontramos esa identificación en el registro de voluntariado.'});
      if (!person.email || !await eligible(tx,person.id,outing.unit)) return fail('Revisá la ficha, el correo y la unidad.');
      if ((await tx`select 1 from registrations where outing_id=${outing.id} and volunteer_id=${person.id}
        and status in ('revisión','espera','confirmada') and id<>${id}`).length) return fail('La persona ya tiene una inscripción activa.');
      await recoverRegistration(tx,id,{id:String(outing.id),capacity:Number(outing.capacity)},person.id,user.subject);
    } else {
      const result = await changeRegistrationStatus(tx,id,user.subject,action,reason,field(form,'approveDates'));
      if (result.saved !== true) return decisionFailure(result.error || 'No se pudo confirmar la gestión de la inscripción.');
    }
    return { saved:true, back: success };

}
