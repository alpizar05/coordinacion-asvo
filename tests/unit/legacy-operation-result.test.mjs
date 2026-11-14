import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyResultMessage} from '../../lib/legacy-operation-result.ts';
test('legacy HTTP feedback retains general and all independent field messages',()=>{
 const result={error:'Conflict',fieldErrors:{capacity:['Required','Invalid'],reason:'Required'}};
 const before=structuredClone(result);assert.equal(legacyResultMessage(result),'Conflict Required Invalid');assert.deepEqual(result,before);
});
test('legacy HTTP feedback uses a safe fallback for empty feedback, never an outcome sentinel',()=>{
 assert.equal(legacyResultMessage({},'Retry'),'Retry');assert.equal(legacyResultMessage({fieldErrors:{a:[' ','']}}),'Revisá los datos e intentá de nuevo.');
 assert.equal(legacyResultMessage({error:'completada'}),'completada'); // presentation only, not success classification
});
