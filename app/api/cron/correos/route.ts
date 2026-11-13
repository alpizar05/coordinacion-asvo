import {readCronConfiguration,logSafeFailure} from '../../../../lib/server-config.mjs';
import { sql } from '../../../../lib/db';
import { flushRegistrationMail } from '../../../../lib/mail-outbox.mjs';
import { handleMailCron } from '../../../../lib/mail-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  let config;try{config=readCronConfiguration();}catch(error){logSafeFailure('cron',error);return Response.json({error:'Cron no configurado.'},{status:503,headers:{'Cache-Control':'private, no-store'}});}
  return handleMailCron(request, {
    secret: config.secret,
    enabled: config.enabled,
    flush: () => flushRegistrationMail(sql),
  });
}
