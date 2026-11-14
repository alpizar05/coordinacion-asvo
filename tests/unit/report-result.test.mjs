import test from 'node:test';
import assert from 'node:assert/strict';
import {reportSubmissionResult,reportConfirmation} from '../../lib/report-result.ts';

test('report navigation requires explicit persistence of the requested draft/final status',()=>{
  for(const [mode,status,query] of [['borrador','borrador','borrador=1'],['finalizar','finalizado','enviado=1']]) {
    assert.deepEqual(reportSubmissionResult({saved:true,id:'fictitious-report',status},'fictitious-link',mode),{
      saved:true,destination:`/resumen-salida/fictitious-link/informe?${query}`,
    });
  }
});
test('legacy, missing and contradictory report responses never imply success',()=>{
  for(const result of [undefined,null,{},'ok',{id:'legacy',status:'finalizado'},{saved:'true'},
    {saved:true,status:'finalizado'},{saved:true,id:'',status:'finalizado'},
    {saved:true,id:'fictitious',status:'borrador'},{saved:true,id:'fictitious',status:'unknown'},
    {saved:true,id:'fictitious',status:'finalizado',error:'Conflict'},
    {saved:true,id:'fictitious',status:'finalizado',fieldErrors:{accuracy:'Required'}}]) {
    const mapped=reportSubmissionResult(result,'fictitious-link','finalizar');
    assert.notEqual(mapped.saved,true);assert.ok(mapped.error);assert.equal(mapped.destination,undefined);
  }
});
test('report failures preserve general and multiple field messages without mutating data',()=>{
  const result={error:'General fictitious failure',fieldErrors:{labour:['Choose work','Check selection'],ends:'Invalid range'}};
  const before=structuredClone(result);
  assert.deepEqual(reportSubmissionResult(result,'fictitious-link','borrador'),result);
  assert.deepEqual(result,before);
});
test('report confirmation flags require a matching persisted report state',()=>{
  for(const query of [{},{enviado:'1'},{borrador:'1'},{enviado:'1',borrador:'1'}])assert.equal(reportConfirmation(undefined,query),'');
  assert.equal(reportConfirmation('borrador',{enviado:'1'}),'');
  assert.equal(reportConfirmation('finalizado',{borrador:'1'}),'');
  assert.match(reportConfirmation('borrador',{borrador:'1'}),/sigue pendiente/);
  assert.match(reportConfirmation('finalizado',{enviado:'1'}),/ya no se puede editar/);
});
