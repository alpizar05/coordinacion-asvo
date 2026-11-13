import {recoverRegistration, assignRegistration70, changeRegistrationStatus} from "./registration-workflow";
import {canOperate, requireStaff} from "./auth";
import {eligible, field, identification} from "./registration";

export async function manageLegacyEntry(tx:import("./registration").Transaction,id:string,fromList:boolean,filter:string,form:FormData,user:import("./authorization").StaffPrincipal){
 const action=field(form,"action"),reason=field(form,"reason");
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

}
