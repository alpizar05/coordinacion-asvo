import { migrateRegistrationWorkflow } from '../lib/registration-workflow-migration.mjs';
import { flushRegistrationMail } from '../lib/mail-outbox.mjs';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

const sql = postgres(process.env.DATABASE_URL);
try {
  await sql.unsafe(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  await migrateRegistrationWorkflow(sql, { origin: new URL(process.env.APP_URL).origin,
    demo: process.env.ASVO_DEMO === '1', managementHours: Number(process.env.MANAGEMENT_HOURS) || 72 });
  if (process.env.ASVO_DEMO !== '1') await flushRegistrationMail(sql);
  if (process.argv.includes('--demo')) {
    if (process.env.ASVO_DEMO !== '1') throw new Error('Activá ASVO_DEMO en una base local de prueba.');
    await sql`insert into grants(subject,role) values ('local-admin','admin') on conflict do nothing`;
  }
} finally {
  await sql.end();
}
