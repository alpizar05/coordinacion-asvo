/** Pure decisions. Call only with the state read under the operation's existing transaction/locks. */
export const workflowStates={
 outings:['borrador','abierta','confirmada','completada','cancelada'],
 registrations:['validación','revisión','espera','confirmada','rechazada','cancelada por coordinación','cancelada por voluntariado'],
 reports:['borrador','finalizado'],
} as const;
export const registrationStates={active:['revisión','espera','confirmada'],occupied:['revisión','confirmada'],
 duplicate:['validación','revisión','espera','confirmada'],cancelled:['cancelada por coordinación','cancelada por voluntariado']} as const;
export const outingIsOpen=(status:string)=>['abierta','confirmada'].includes(status);
export const outingIsEditable=(status:string)=>['borrador','abierta','confirmada'].includes(status);
export const registrationIsActive=(status:string)=>registrationStates.active.some(value=>value===status);
export const registrationConsumesSeat=(status:string)=>registrationStates.occupied.some(value=>value===status);
export const registrationCanReopen=(status:string,action:string)=>action==='confirmar'&&registrationStates.cancelled.some(value=>value===status);
export const registrationStaffMutable=(status:string,action:string)=>registrationIsActive(status)||registrationCanReopen(status,action);

export function reservationTransition(used:number,capacity:number,source:'received'|'recovered'='received'){
 const status=used<capacity?'revisión':'espera';
 return {status,audit:source==='received'?'Recibió inscripción':'Recuperó inscripción anterior',
  message:source==='recovered'?'Tu inscripción anterior fue incorporada al nuevo flujo de recepción de solicitudes.':status==='revisión'
   ?'Recibimos tu inscripción y reservamos un cupo. Coordinación debe confirmar tu participación.'
   :'Recibimos tu inscripción. Los cupos están cubiertos y quedaste en lista de espera. Te avisaremos si se libera un cupo.'};
}
export const promotionTransition={status:'revisión',audit:'Asignó cupo desde lista de espera',
 message:'Se liberó un cupo y lo reservamos para vos por orden de recepción. Coordinación debe confirmar tu participación.'} as const;

export function staffRegistrationTransition(status:string,outingStatus:string,action:string,reason:string){
 if(!registrationStaffMutable(status,action))return {error:'Esta inscripción ya no está activa.'} as const;
 if(!outingIsOpen(outingStatus))return {error:'La salida debe estar abierta o confirmada.'} as const;
 if(!['confirmar','espera','rechazar','cancelar'].includes(action))return {error:'Elegí una acción válida.'} as const;
 if(action!=='confirmar'&&!reason)return {error:'Indicá el motivo.'} as const;
 if(action==='espera'&&status==='espera')return {error:'La inscripción ya está en lista de espera.'} as const;
 if(action==='confirmar'&&status==='confirmada')return {error:'La inscripción ya está confirmada.'} as const;
 const reopening=registrationCanReopen(status,action);
 const next=action==='confirmar'?'confirmada':action==='espera'?'espera':action==='rechazar'?'rechazada':'cancelada por coordinación';
 return {status:next,reopening,audit:action==='confirmar'?(reopening?'Reactivó y confirmó inscripción cancelada':'Confirmó cupo'):action==='espera'?'Movió a lista de espera':next,
 message:action==='confirmar'?'Coordinación confirmó tu participación. Tu cupo está confirmado.':`${action==='espera'?'Coordinación movió tu inscripción a lista de espera.':action==='rechazar'?'Coordinación rechazó tu inscripción.':'Coordinación canceló tu inscripción.'} Motivo: ${reason}`};
}
export function assign70Transition(status:string,outingStatus:string,assigned:boolean){
 if(status!=='confirmada')return {error:'Solo se puede asignar como 70 a una persona con inscripción confirmada.'} as const;
 if(!outingIsOpen(outingStatus))return {error:'La salida debe estar abierta o confirmada.'} as const;
 return {audit:assigned?'Asignó como 70':'Retiró asignación de 70',message:assigned?'Coordinación te asignó como 70 para esta salida.':'Coordinación retiró tu asignación como 70 para esta salida. Tu inscripción continúa confirmada.'};
}
export function editRegistrationTransition(status:string,datesChanged:boolean,source:'staff'|'private'){
 const next=status==='confirmada'&&datesChanged?'revisión':status;
 return {status:next,revokeBrief:next!=='confirmada',audit:source==='staff'?'Editó inscripción desde Coordinación':'Editó inscripción',
 message:source==='staff'?(datesChanged&&status==='confirmada'
  ?'Coordinación actualizó tus fechas de participación. Conservás el cupo reservado; las fechas nuevas están en revisión.'
  :'Coordinación actualizó los datos de tu inscripción. Podés consultar el detalle en tu enlace privado.')
  :(datesChanged&&status==='confirmada'?'Actualizaste tus fechas. Conservás el cupo reservado y Coordinación debe confirmar las fechas nuevas.':'Guardamos los cambios de tu inscripción.')};
}
export function privateRegistrationTransition(status:string,action:string){
 if(action==='cancelar'&&status==='cancelada por voluntariado')return {kind:'noop'} as const;
 if(!registrationIsActive(status))return {kind:'error',error:'Esta inscripción ya no está activa. Actualizá la página para consultar su estado.'} as const;
 if(action==='cancelar')return {kind:'cancel',status:'cancelada por voluntariado',audit:'Canceló inscripción'} as const;
 if(action==='editar')return {kind:'edit'} as const;
 return {kind:'error',error:'Elegí una acción válida.'} as const;
}

export function newOutingTransition(publish:boolean){return {status:publish?'abierta':'borrador',audit:publish?'Creó y publicó convocatoria':'Creó salida'};}
export type OutingStateAction='completar'|'eliminar'|'cancelar-salida'|'publicar';
export type OutingTransitionDecision={error:'closed'|'not-open'|'not-finished'|'has-registrations'|'no-registrations'|'no-cover'|'unknown-action'}|{noop:true}|{status:'abierta'|'cancelada'|'completada'|null;audit:string};
export function outingTransition(status:string,action:OutingStateAction,facts:{finished?:boolean;hasRegistrations?:boolean;hasCover?:boolean}={}):OutingTransitionDecision{
 if(!outingIsEditable(status))return {error:'closed'} as const;
 if(action==='completar'){
  if(!outingIsOpen(status))return {error:'not-open'} as const;
  if(!facts.finished)return {error:'not-finished'} as const;
  return {status:'completada',audit:'Completó convocatoria'} as const;
 }
 if(action==='eliminar')return facts.hasRegistrations?{error:'has-registrations'} as const:{status:null,audit:'Eliminó convocatoria'} as const;
 if(action==='cancelar-salida')return !facts.hasRegistrations?{error:'no-registrations'} as const:{status:'cancelada',audit:'Canceló convocatoria'} as const;
 if(action==='publicar'){
  if(status!=='borrador')return {noop:true} as const;
  if(!facts.hasCover)return {error:'no-cover'} as const;
  return {status:'abierta',audit:'Publicó convocatoria'} as const;
 }
 return {error:'unknown-action'} as const;
}
/** Keep the existing SQL guard: only a draft can be replaced, even for a historical unknown status. */
export function reportTransition(existingStatus:string|undefined,mode:'borrador'|'finalizar'){
 const draft=mode==='borrador';
 return {locked:existingStatus==='finalizado',writable:existingStatus===undefined||existingStatus==='borrador',draft,
  status:draft?'borrador':'finalizado',creditsAttendance:!draft,
  audit:draft?'Guardó borrador de informe':'Finalizó informe de salida'};
}

export function outingCancellationTransition(reason:string){return {status:'cancelada por coordinación',message:`Coordinación canceló la salida. Motivo: ${reason}`};}
export function outingTransitionError(code:string,legacy=false){
 switch(code){
  case 'closed':return 'Esta convocatoria está cerrada para edición.';
  case 'not-open':return 'Solo se puede completar una salida abierta o confirmada.';
  case 'not-finished':return legacy?'Podés completar la salida a partir del día siguiente a la fecha de regreso.':'Podés completar la salida a partir del día siguiente al regreso.';
  case 'has-registrations':return 'La convocatoria tiene inscripciones. Podés cancelarla.';
  case 'no-registrations':return 'La convocatoria no tiene inscripciones. Podés eliminarla.';
  case 'no-cover':return 'Adjuntá una foto de portada antes de publicar.';
  default:return 'La acción no está disponible.';
 }
}
