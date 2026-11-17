import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedStaffRegistrationAddedResult,isStaffRegistrationReceivedStatus} from '../../lib/staff-registration-result.ts';

test('staff add confirms only the received state, without substituting review for waiting',()=>{
 for(const status of ['revisión','espera']){
  const response=Object.freeze({saved:true,status,id:'fictitious-id'});
  assert.deepEqual(checkedStaffRegistrationAddedResult(response),{saved:true,destination:undefined,status});
  assert.equal(response.status,status);
  assert.equal(isStaffRegistrationReceivedStatus(status),true);
 }
});
test('staff add rejects unknown, absent, malformed and contradictory responses',()=>{
 for(const response of [undefined,null,{},[],true,'OK',{saved:'true',status:'revisión'},
  {saved:1,status:'espera'},{saved:true},{saved:true,status:undefined},{saved:true,status:''},
  {saved:true,status:'confirmada'},{saved:true,status:'validación'},{saved:true,status:'revision'},
  {saved:true,status:42},{saved:true,status:['revisión']},
  {saved:true,status:'revisión',error:'Conflicto'},{saved:true,status:'espera',fieldErrors:{starts:'Inválida'}}]){
  const result=checkedStaffRegistrationAddedResult(response);
  assert.notEqual(result.saved,true);assert.ok(result.error);assert.equal(result.status,undefined);
 }
 for(const value of ['confirmada','validación','cancelada',null,undefined,42])assert.equal(isStaffRegistrationReceivedStatus(value),false);
});
test('staff add preserves general and independent field errors together without mutation',()=>{
 const response={saved:false,error:'Conflicto general',fieldErrors:{volunteer:['Elegí una persona','Revisá su ficha'],ends:'Fecha inválida'}};
 const before=structuredClone(response);
 const result=checkedStaffRegistrationAddedResult(response);
 assert.equal(result.error,response.error);assert.deepEqual(result.fieldErrors,response.fieldErrors);
 assert.deepEqual(response,before);assert.notEqual(result.saved,true);
 assert.deepEqual(checkedStaffRegistrationAddedResult({error:'Sin permiso'}),{error:'Sin permiso',fieldErrors:undefined});
 assert.deepEqual(checkedStaffRegistrationAddedResult({fieldErrors:{ends:'Fecha'}}),{error:undefined,fieldErrors:{ends:'Fecha'}});
});
