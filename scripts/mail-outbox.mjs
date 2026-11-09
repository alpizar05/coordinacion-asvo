import postgres from 'postgres';
import { flushRegistrationMail } from '../lib/mail-outbox.mjs';
const sql = postgres(process.env.DATABASE_URL);
try {
  if (process.env.ASVO_DEMO === '1') throw new Error('En modo demo, los mensajes se guardan en la bandeja de prueba.');
  do {
    await flushRegistrationMail(sql);
    if (!process.argv.includes('--watch')) break;
    await new Promise(resolve => setTimeout(resolve, 60000));
  } while (true);
}
finally { await sql.end(); }
