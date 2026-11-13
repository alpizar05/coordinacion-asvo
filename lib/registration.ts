import { createHash } from 'node:crypto';
import type postgres from 'postgres';

export type Transaction = postgres.TransactionSql;
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export {historicalIdentification as identification} from './form-input';
export const field = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export {validFormDate as date} from './form-dates.mjs';
export const displayDate = (value: string) => value.split('-').reverse().join('/');
export function hours(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function eligible(tx: Transaction, volunteerId: string, unit: string) {
  const [person] = await tx`select units from volunteers where id=${volunteerId}`;
  return !!person && (unit === 'Voluntariado General' || person.units.includes(unit));
}

export async function audit(tx: Transaction, actor: string, action: string, target: string, reason?: string) {
  await tx`insert into audit(actor,action,target,reason) values (${actor},${action},${target},${reason || null})`;
}

export { suggestedGroups, outingIsEditable } from './registration-rules';
import { cancellationWarning as warningAt } from './registration-rules';
export function cancellationWarning(starts: string, now = Date.now()) {
  return warningAt(starts, now, hours('CANCELLATION_HOURS',48));
}
