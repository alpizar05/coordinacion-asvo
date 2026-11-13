import {validPrivateToken} from './authorization';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { sql } from './db';
import { digest, type Transaction } from './registration';

export const receiptCookie = (outingId: string) => `asvo-receipt-${outingId}`;

export async function createRegistrationReceipt(tx: Transaction, registrationId: string, status: string) {
  const token = randomBytes(32).toString('base64url');
  await tx`insert into registration_receipts(digest,registration_id,status) values (${digest(token)},${registrationId},${status})`;
  return token;
}

export async function readRegistrationReceipt(outingId: string) {
  const token = (await cookies()).get(receiptCookie(outingId))?.value;
  if (!validPrivateToken(token)) return;
  const [receipt] = await sql<{ name: string; firstName: string; status: string }[]>`select concat_ws(' ',v.name,v.surname,v.second_surname) as name,v.name as "firstName",receipt.status
    from registration_receipts receipt join registrations r on r.id=receipt.registration_id
    join volunteers v on v.id=r.volunteer_id
    where receipt.digest=${digest(token)} and receipt.revoked_at is null and receipt.expires_at>clock_timestamp() and r.outing_id=${outingId}`;
  return receipt;
}
