import test from 'node:test';import assert from 'node:assert/strict';
import {sendOutcome,graphRequestReference,retryDelayMs,validateMailReview} from '../../lib/mail-attempt-rules.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('sendMail acceptance is 202 only; ambiguous transport/server responses never authorize automatic retry',()=>{
 assert.equal(sendOutcome(202),'accepted');
 for(const status of [400,401,403,404,409,429])assert.equal(sendOutcome(status),'rejected');
 for(const status of [408,500,502,503,504,200,204,302,undefined,NaN,'202'])assert.equal(sendOutcome(status),'uncertain');
});
test('correlation stores UUID only; retry timing respects five minutes and capped Retry-After',()=>{
 assert.equal(graphRequestReference(id.toUpperCase()),id);
 for(const value of [null,{},'token-secret','person@example.test',id+'\n'])assert.equal(graphRequestReference(value),null);
 const now=Date.parse('2035-01-01T00:00:00Z');assert.equal(retryDelayMs('1',now),300000);assert.equal(retryDelayMs('600',now),600000);
 assert.equal(retryDelayMs('Thu, 01 Jan 2035 00:20:00 GMT',now),1200000);assert.equal(retryDelayMs(null,now),300000);assert.equal(retryDelayMs('999999999',now),86400000);
});
test('operator review requires bounded identities, attempt, evidence or explicit duplicate risk acknowledgement',()=>{
 const base={mailId:'1',attemptId:id,actor:'test-operator',decision:'accepted',reason:'acceptance_evidence',evidence:id};
 assert.doesNotThrow(()=>validateMailReview(base));assert.doesNotThrow(()=>validateMailReview({...base,decision:'retry',reason:'duplicate_risk_acknowledged'}));
 assert.doesNotThrow(()=>validateMailReview({...base,decision:'cancel',reason:'cancel_after_review',evidence:undefined}));
 for(const change of [{mailId:0},{attemptId:'other'},{actor:'too much private text'},{decision:'other'},{evidence:'secret'},{evidence:null},{reason:'retry'}])assert.throws(()=>validateMailReview({...base,...change}));
});
