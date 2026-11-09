import { sql } from '../../../../lib/db';
import { flushRegistrationMail } from '../../../../lib/mail-outbox.mjs';
import { handleMailCron } from '../../../../lib/mail-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleMailCron(request, {
    secret: process.env.CRON_SECRET,
    enabled: process.env.ASVO_DEMO !== '1' &&
      (!process.env.VERCEL || process.env.VERCEL_ENV === 'production'),
    flush: () => flushRegistrationMail(sql),
  });
}
