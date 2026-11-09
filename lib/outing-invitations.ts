import { sql } from './db';
import { digest, type Transaction } from './registration';

export const registrationToday = sql`(clock_timestamp() at time zone 'America/Costa_Rica')::date`;

export async function activeOutingInvitation(outingId: string, token?: string, tx?: Transaction) {
  if (!token || !/^[\w-]{43}$/.test(token)) return;
  const db = tx ?? sql;
  const [invitation] = await db<{ digest: string; volunteer_id: string }[]>`
    select digest,volunteer_id from outing_invitations
    where digest=${digest(token)} and outing_id=${outingId}
      and used_at is null and expires_at > clock_timestamp()`;
  return invitation;
}
