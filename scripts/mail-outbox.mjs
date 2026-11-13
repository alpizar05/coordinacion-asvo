import {databaseConfiguration} from '../lib/runtime-config.mjs';
import postgres from 'postgres';
import './node-server-context.mjs';
const {flushRegistrationMail}=await import('../lib/mail-outbox.mjs');
const sql = postgres(databaseConfiguration(process.env).url);
try {
  if (process.env.ASVO_DEMO === '1') throw new Error('En modo demo, los mensajes se guardan en la bandeja de prueba.');
  do {
    await flushRegistrationMail(sql);
    if (!process.argv.includes('--watch')) break;
    await new Promise(resolve => setTimeout(resolve, 60000));
  } while (true);
}
finally { await sql.end(); }
