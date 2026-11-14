import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedPhotoResult,PhotoMutationError} from '../../lib/photo-result.ts';
test('photo preparation never claims server persistence; persistence requires explicit saved',()=>{
 assert.deepEqual(checkedPhotoResult({prepared:true},'prepare'),{prepared:true});
 assert.equal(checkedPhotoResult({saved:true},'persist').saved,true);
 for(const mode of ['prepare','persist'])for(const bad of [undefined,'OK',{}, {saved:'true'},{prepared:'true'},{prepared:true,error:'Conflict'}]){
  const result=checkedPhotoResult(bad,mode);assert.ok(result.error);assert.notEqual(result.saved,true);assert.notEqual(result.prepared,true);
 }
 assert.ok(checkedPhotoResult({saved:true},'prepare').error);
 assert.ok(checkedPhotoResult({prepared:true},'persist').error);
 assert.ok(checkedPhotoResult({prepared:true,saved:true},'prepare').error);
});
test('photo feedback retains all independent messages and general conflicts',()=>{
 const fields={photo:['Invalid format','Too large'],alt:'Required',credit:'Too long',permission:'Required',photoId:'Unavailable'};
 for(const mode of ['prepare','persist'])assert.deepEqual(checkedPhotoResult({fieldErrors:fields},mode).fieldErrors,fields);
 const conflict=new PhotoMutationError('Wording can change');assert.equal(conflict.fieldErrors,undefined);
 const validation=new PhotoMutationError('Review',fields);assert.deepEqual(validation.fieldErrors,fields);
 for(const mode of ['prepare','persist'])assert.equal(checkedPhotoResult({error:conflict.message},mode).error,conflict.message);
});
