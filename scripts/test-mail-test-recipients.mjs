import assert from 'node:assert/strict';
import { flushRegistrationMail, isTestRecipient } from '../lib/mail-outbox.mjs';
for (const email of ['persona@gmail.com.test','persona@EXAMPLE.TEST',' persona@gmail.com.test  ']) assert.equal(isTestRecipient(email),true);
for (const email of ['persona.test@gmail.com','persona@gmail.com','persona@test.com']) assert.equal(isTestRecipient(email),false);
const originalFetch = globalThis.fetch;
let fetchCalls=0, claimed=0, cancelled=0;
globalThis.fetch=async()=>{fetchCalls++;throw new Error('No debe invocar Graph');};
try {
  const sql=async(strings, ...values)=>{
    const query=strings.join('?');
    if(query.includes('returning id,recipient,subject,body,html_body')) return claimed++ === 0 ? [{id:1,recipient:'persona@gmail.com.TEST',subject:'Prueba',body:'Prueba'}] : [];
    if(query.includes('cancelled_at=now()')) {assert.equal(values[0],1);cancelled++;return [];}
    throw new Error('Consulta inesperada');
  };
  assert.deepEqual(await flushRegistrationMail(sql),{sent:0,failed:0});
  assert.equal(cancelled,1);assert.equal(fetchCalls,0);
  console.log('OK: destinatarios .test cancelados sin autenticación ni envío a Graph.');
} finally {globalThis.fetch=originalFetch;}
// A 200 with malformed token JSON must leave mail pending, never call sendMail.
let sent=0,network=0;
try{
 globalThis.fetch=async()=>{network++;return {ok:true,json:async()=>({access_token:{secret:'must-not-be-used'}})};};
 const sql=async(strings)=>{const query=strings.join('?');if(query.includes('returning id,recipient,subject,body,html_body'))return [{id:2,recipient:'fake@example.invalid',subject:'Ficticio',body:'Ficticio'}];if(query.includes('from report_reminders'))return [];if(query.includes('sent_at=now()')){sent++;return [];}throw Error('Consulta inesperada');};
 assert.deepEqual(await flushRegistrationMail(sql),{sent:0,failed:1});assert.equal(network,1);assert.equal(sent,0);
 console.log('OK: respuesta de token malformada conserva el correo pendiente sin enviar.');
}finally{globalThis.fetch=originalFetch;}
