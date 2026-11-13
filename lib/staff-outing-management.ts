import {outingIsOpen, outingTransition, outingTransitionError} from "./workflow-transitions";
import {applyOutingState} from "./outing-state-transition";
import {occupiedSeats, promoteWaitlist} from "./registration-workflow";
import {outingLogisticsFields} from "./outing-logistics";
import {canOperate, requireStaff} from "./auth";
import {inheritGeneralPhotos} from "./outing-inheritance";
import {registrationToday} from "./outing-invitations";
import {commonOutingFields} from "./collection-fields";
import {audit, date, field, outingIsEditable} from "./registration";
import {outingUnitHasConflict} from "./outing-unit-conflict";

export async function manageOutingRecord(tx:import("./registration").Transaction,id:string,form:FormData,user:import("./authorization").StaffPrincipal){
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

}
