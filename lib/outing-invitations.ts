import {validPrivateToken} from './authorization';
import {invitationAccessCondition} from './authorization-sql';
import { sql } from './db';
import { type Transaction } from './registration';

export const registrationToday = sql`(clock_timestamp() at time zone 'America/Costa_Rica')::date`;

export async function activeOutingInvitation(outingId: string, token?: string, tx?: Transaction) {
  if (!validPrivateToken(token)) return;
  const db = tx ?? sql;
  const [invitation] = await db<{ digest: string; volunteer_id: string }[]>`
    select digest,volunteer_id from outing_invitations
    where ${invitationAccessCondition(db,outingId,token)}`;
  return invitation;
}
