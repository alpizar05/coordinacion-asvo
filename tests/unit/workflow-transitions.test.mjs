import test from 'node:test';import assert from 'node:assert/strict';
import {workflowStates,registrationIsActive,registrationConsumesSeat,registrationCanReopen,outingIsOpen,outingIsEditable,
 reservationTransition,promotionTransition,staffRegistrationTransition,privateRegistrationTransition,editRegistrationTransition,
 assign70Transition,outingTransition,newOutingTransition,reportTransition,outingCancellationTransition,outingTransitionError} from '../../lib/workflow-transitions.ts';
test('known state inventories are explicit; unknown historical values are never treated as active',()=>{
 assert.deepEqual(workflowStates.outings,['borrador','abierta','confirmada','completada','cancelada']);
 assert.equal(workflowStates.registrations.length,7);assert.deepEqual(workflowStates.reports,['borrador','finalizado']);
 for(const status of [...workflowStates.registrations,'histórico desconocido']){
  assert.equal(registrationConsumesSeat(status),['revisión','confirmada'].includes(status));
  assert.equal(registrationIsActive(status),['revisión','espera','confirmada'].includes(status));
 }
 for(const status of [...workflowStates.outings,'histórico desconocido']){
  assert.equal(outingIsOpen(status),['abierta','confirmada'].includes(status));assert.equal(outingIsEditable(status),['borrador','abierta','confirmada'].includes(status));
 }
});
test('reservation boundaries and promotion retain status, audit and queue notification semantics',()=>{
 assert.equal(reservationTransition(0,1).status,'revisión');assert.equal(reservationTransition(1,1).status,'espera');assert.equal(reservationTransition(2,1).status,'espera');
 assert.equal(reservationTransition(1,2,'recovered').audit,'Recuperó inscripción anterior');assert.equal(reservationTransition(2,2,'recovered').status,'espera');
 assert.equal(promotionTransition.status,'revisión');assert.match(promotionTransition.message,/orden de recepción/);assert.match(reservationTransition(1,1).message,/lista de espera/);
});
test('staff decisions preserve active transitions, cancelled recovery and required reasons',()=>{
 for(const from of ['revisión','espera','confirmada'])for(const [action,status]of [['confirmar','confirmada'],['espera','espera'],['rechazar','rechazada'],['cancelar','cancelada por coordinación']]){
  const plan=staffRegistrationTransition(from,'abierta',action,'Motivo ficticio');
  if(from===status)assert.ok(plan.error);else {assert.equal(plan.status,status);assert.ok(plan.audit);assert.ok(plan.message);}
 }
 for(const from of ['cancelada por coordinación','cancelada por voluntariado']){
  const plan=staffRegistrationTransition(from,'confirmada','confirmar','');assert.equal(plan.status,'confirmada');assert.equal(plan.reopening,true);assert.equal(plan.audit,'Reactivó y confirmó inscripción cancelada');
  for(const action of ['espera','rechazar','cancelar'])assert.ok(staffRegistrationTransition(from,'abierta',action,'Motivo').error);
 }
 for(const action of ['espera','rechazar','cancelar'])assert.equal(staffRegistrationTransition('revisión','abierta',action,'').error,'Indicá el motivo.');
 for(const from of ['validación','rechazada','completada','desconocido'])assert.ok(staffRegistrationTransition(from,'abierta','confirmar','').error);
 assert.ok(staffRegistrationTransition('revisión','cancelada','confirmar','').error);assert.ok(staffRegistrationTransition('revisión','abierta','unknown','').error);
 assert.equal(registrationCanReopen('rechazada','confirmar'),false);
});
test('private cancellation is idempotent only for self-cancellation; other inactive states stay blocked',()=>{
 assert.equal(privateRegistrationTransition('cancelada por voluntariado','cancelar').kind,'noop');
 for(const status of ['cancelada por coordinación','rechazada','validación','desconocido'])assert.equal(privateRegistrationTransition(status,'cancelar').kind,'error');
 assert.equal(privateRegistrationTransition('confirmada','cancelar').status,'cancelada por voluntariado');assert.equal(privateRegistrationTransition('espera','editar').kind,'edit');assert.equal(privateRegistrationTransition('revisión','unknown').kind,'error');
});
test('editing dates preserves the reservation and keeps staff/private messages distinct',()=>{
 for(const source of ['staff','private']){
  assert.equal(editRegistrationTransition('confirmada',true,source).status,'revisión');assert.equal(editRegistrationTransition('confirmada',false,source).status,'confirmada');
  assert.equal(editRegistrationTransition('espera',true,source).status,'espera');assert.equal(editRegistrationTransition('revisión',false,source).revokeBrief,true);
  assert.match(editRegistrationTransition('confirmada',true,source).message,/cup[oa]/i);
 }
 assert.notEqual(editRegistrationTransition('confirmada',true,'staff').audit,editRegistrationTransition('confirmada',true,'private').audit);
 assert.equal(editRegistrationTransition('histórico',false,'staff').status,'histórico','Decision does not normalize an unrecognized historical value; caller enforces active state');
});
test('70 assignments require a confirmed entry and an open/confirmed outing',()=>{
 for(const assigned of [true,false]){
  assert.ok(assign70Transition('revisión','abierta',assigned).error);assert.ok(assign70Transition('confirmada','completada',assigned).error);
  assert.ok(assign70Transition('confirmada','abierta',assigned).audit);assert.ok(assign70Transition('confirmada','confirmada',assigned).message);
 }
});
test('outings keep publishing, completion, cancellation and deletion preconditions separate',()=>{
 assert.equal(newOutingTransition(true).status,'abierta');assert.equal(newOutingTransition(false).status,'borrador');
 assert.equal(outingTransition('borrador','publicar').error,'no-cover');assert.equal(outingTransition('borrador','publicar',{hasCover:true}).status,'abierta');assert.equal(outingTransition('abierta','publicar').noop,true);
 assert.equal(outingTransition('borrador','completar',{finished:true}).error,'not-open');assert.equal(outingTransition('abierta','completar',{finished:false}).error,'not-finished');
 for(const status of ['abierta','confirmada'])assert.equal(outingTransition(status,'completar',{finished:true}).status,'completada');
 assert.equal(outingTransition('abierta','cancelar-salida',{hasRegistrations:false}).error,'no-registrations');assert.equal(outingTransition('abierta','cancelar-salida',{hasRegistrations:true}).status,'cancelada');
 assert.equal(outingTransition('abierta','eliminar',{hasRegistrations:true}).error,'has-registrations');assert.equal(outingTransition('abierta','eliminar',{hasRegistrations:false}).status,null);
 for(const status of ['cancelada','completada','histórico'])for(const action of ['publicar','completar','cancelar-salida','eliminar'])assert.equal(outingTransition(status,action,{finished:true,hasCover:true}).error,'closed');
 assert.equal(outingTransition('abierta','unknown').error,'unknown-action');assert.match(outingCancellationTransition('Prueba').message,/Prueba/);
 assert.notEqual(outingTransitionError('not-finished'),outingTransitionError('not-finished',true));
 for(const code of ['closed','not-open','has-registrations','no-registrations','no-cover','unknown'])assert.ok(outingTransitionError(code));
});
test('reports keep drafts editable, finalized records locked and unknown states unwritable without normalization',()=>{
 const draft=reportTransition(undefined,'borrador');assert.equal(draft.status,'borrador');assert.equal(draft.creditsAttendance,false);assert.equal(draft.writable,true);
 const final=reportTransition('borrador','finalizar');assert.equal(final.status,'finalizado');assert.equal(final.creditsAttendance,true);assert.equal(final.locked,false);
 for(const mode of ['borrador','finalizar'])assert.equal(reportTransition('finalizado',mode).locked,true);
 assert.equal(reportTransition('unknown','finalizar').writable,false);assert.equal(reportTransition('unknown','borrador').locked,false,'Keep existing post-validation SQL conflict handling');
});
