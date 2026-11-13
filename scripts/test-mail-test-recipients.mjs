import assert from 'node:assert/strict';
import {flushRegistrationMail,isTestRecipient} from '../lib/mail-outbox.mjs';
import {graphMail} from '../lib/graph-mail.mjs';
for(const email of ['persona@gmail.com.test','persona@EXAMPLE.TEST',' persona@gmail.com.test  '])assert.equal(isTestRecipient(email),true);
for(const email of ['persona.test@gmail.com','persona@gmail.com','persona@test.com'])assert.equal(isTestRecipient(email),false);
let claimed=false,cancelled=0,calls=0;
const sql=async(strings,...values)=>{
 const query=strings.join('?');
 if(query.includes('join registration_mail_attempts a on a.id=m.active_attempt'))return [];
 if(query.includes('select pending.id')){if(claimed)return [];claimed=true;return [{id:1,recipient:'persona@example.TEST',attempts:0}];}
 if(query.includes('insert into registration_mail_attempts'))return [{id:values[0],client_request_id:values.at(-1)}];
 if(query.includes('set active_attempt='))return [];
 if(query.includes("delivery_state='reserved' for update"))return [{id:1}];
 if(query.includes("set state='cancelled'"))return [];
 if(query.includes("delivery_state='cancelled',cancelled_at")){cancelled++;return [];}
 throw Error('Consulta inesperada: '+query);
};
sql.begin=work=>work(sql);
const graph={authenticate:async()=>{calls++;throw Error('No debe invocar Graph');},send:async()=>{calls++;throw Error('No debe invocar Graph');}};
assert.deepEqual(await flushRegistrationMail(sql,{graph}),{sent:0,failed:0});assert.equal(cancelled,1);assert.equal(calls,0);
await assert.rejects(()=>flushRegistrationMail(async()=>[]),/conexión raíz/);
console.log('OK: destinatarios .test cancelados antes de Graph; worker rechaza transacciones no durables.');
let network=0;
const service=graphMail({env:{GRAPH_TENANT_ID:'11111111-1111-4111-8111-111111111111',GRAPH_CLIENT_ID:'22222222-2222-4222-8222-222222222222',GRAPH_CLIENT_SECRET:'test-only',GRAPH_SENDER:'sender@example.test'},request:async()=>{network++;return Response.json({access_token:{secret:'must-not-be-used'}});}});
await assert.rejects(()=>service.authenticate(),/autenticación inválida/);assert.equal(network,1);
console.log('OK: token malformado rechazado antes de sendMail; ningún secreto expuesto.');
