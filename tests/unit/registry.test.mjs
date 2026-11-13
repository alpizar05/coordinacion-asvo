import test from 'node:test';import assert from 'node:assert/strict';
import {validateRegistryForm} from '../../lib/registry-validation.ts';
import {validateOutingDecision} from '../../lib/outing-decision-validation.ts';
import {form,uuid} from './helpers.mjs';
test('policy validation aggregates missing fields, invalid dates, order and length bounds',()=>{
 assert.equal(Object.keys(validateRegistryForm(form(),'policy')).length,5);
 const good={kind:'Demo',number:'DEMO-1',source:'Fuente ficticia',starts:'2035-01-01',ends:'2035-12-31'};
 assert.deepEqual(validateRegistryForm(form(good),'policy'),{});
 assert.ok(validateRegistryForm(form({...good,ends:'2034-12-31'}),'policy').ends);
 assert.deepEqual(Object.keys(validateRegistryForm(form({...good,kind:'x'.repeat(201),number:'x'.repeat(201),source:'x'.repeat(1001)}),'policy')),['kind','number','source']);
 assert.ok(validateRegistryForm(form({...good,ends:'2035-02-30'}),'policy').ends);
});
test('incident may be general; attendance and grants retain their distinct required groups',()=>{
 assert.equal(Object.keys(validateRegistryForm(form(),'incident')).length,2);
 assert.deepEqual(validateRegistryForm(form({occurred_on:'2035-01-01',description:'Ficticio'}),'incident'),{});
 assert.deepEqual(validateRegistryForm(form({occurred_on:'2035-01-01',description:'x'.repeat(4000),outing:uuid(1)}),'incident'),{});
 assert.ok(validateRegistryForm(form({occurred_on:'2035-01-01',description:'x'.repeat(4001),outing:'bad'}),'incident').outing);
 assert.equal(Object.keys(validateRegistryForm(form(),'attendance')).length,2);
 for(const decision of ['participo','no_participo','pendiente'])assert.deepEqual(validateRegistryForm(form({decision,reason:'Motivo'}),'attendance'),{});
 assert.deepEqual(Object.keys(validateRegistryForm(form({subject:'bad',role:'unidad',action:'bad'}),'grant')),['subject','unit','action']);
 for(const role of ['admin','general'])assert.deepEqual(validateRegistryForm(form({subject:uuid(1),role,action:'asignar'}),'grant'),{});
 assert.deepEqual(validateRegistryForm(form({subject:'local-coordination',role:'unidad',unit:'UEA',action:'revocar'}),'grant'),{});
 assert.ok(validateRegistryForm(form({subject:uuid(1),role:'bad',action:'asignar'}),'grant').role);
});
test('outing decisions require only relevant reason or explicit final-action confirmation',()=>{
 for(const action of ['agrupación','cancelar-salida']){assert.ok(validateOutingDecision(form(),action).reason);assert.ok(validateOutingDecision(form({reason:'x'.repeat(4001)}),action).reason);assert.deepEqual(validateOutingDecision(form({reason:'x'.repeat(4000)}),action),{});}
 assert.ok(validateOutingDecision(form(),'completar').confirmCompleted);assert.deepEqual(validateOutingDecision(form({confirmCompleted:'on'}),'completar'),{});
 assert.ok(validateOutingDecision(form(),'eliminar').confirmDelete);assert.deepEqual(validateOutingDecision(form({confirmDelete:'on'}),'eliminar'),{});
 assert.deepEqual(validateOutingDecision(form(),'unknown'),{},'Unknown actions are rejected by the server orchestration, not given artificial fields');
});
