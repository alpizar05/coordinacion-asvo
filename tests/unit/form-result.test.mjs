import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedFormResult} from '../../lib/form-result.ts';

test('operation feedback accepts only explicit unambiguous success',()=>{
  assert.deepEqual(checkedFormResult({saved:true}),{saved:true,destination:undefined});
  assert.deepEqual(checkedFormResult({saved:true,destination:'/coordinacion?unidad=BRIF#salidas',extra:'ignored'}),{
    saved:true,destination:'/coordinacion?unidad=BRIF#salidas',
  });
  for(const value of [undefined,null,'OK',true,false,0,[],{},new Date(),{saved:false},{saved:'true'},{saved:1},
    {destination:'/coordinacion'}, {saved:true,error:''},{saved:true,fieldErrors:{}},{saved:true,destination:42},
    {saved:false,error:'Conflict',destination:'/coordinacion'}]){
    const result=checkedFormResult(value);assert.notEqual(result.saved,true);assert.ok(result.error);assert.equal(result.destination,undefined);
  }
});
test('general failures and every independent field message survive without mutation',()=>{
  const input={saved:false,error:'Concurrent change',fieldErrors:{title:['Required','Too long'],capacity:'Invalid',optional:undefined}};
  const before=structuredClone(input),result=checkedFormResult(input);
  assert.equal(result.saved,undefined);assert.equal(result.error,input.error);assert.deepEqual(result.fieldErrors,input.fieldErrors);
  assert.deepEqual(input,before);
  assert.deepEqual(checkedFormResult({fieldErrors:{name:'Required'}}),{error:undefined,fieldErrors:{name:'Required'}});
  assert.deepEqual(checkedFormResult({error:'Access denied'}),{error:'Access denied',fieldErrors:undefined});
});
test('malformed or empty errors cannot escape as silent failures or successes',()=>{
  for(const value of [{error:42},{fieldErrors:[]},{fieldErrors:null},{fieldErrors:'Required'},
    {fieldErrors:{name:{message:'Required'}}},{fieldErrors:{name:[42]}},
    {error:'  ',fieldErrors:{name:['','  ']}},{fieldErrors:{}},
    {saved:true,error:'Rejected'},{saved:true,fieldErrors:{name:'Required'}}]){
    const result=checkedFormResult(value);assert.notEqual(result.saved,true);assert.ok(result.error);assert.equal(result.fieldErrors,undefined);
  }
});
