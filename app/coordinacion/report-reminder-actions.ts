'use server';

import { revalidatePath } from 'next/cache';
import { canOperate, staff } from '../../lib/auth';
import { sql } from '../../lib/db';
import { field, uuid } from '../../lib/registration';
import { queueReportReminder } from '../../lib/report-reminders';
import { dispatchRegistrationUpdates } from '../../lib/registration-workflow';

export async function sendReportReminder(outingId: string, registrationId: string, form: FormData) {
  const user = await staff();
  if (!uuid(outingId) || !uuid(registrationId)) return { error: 'La salida no es válida.' };
  const result = await sql.begin(async tx => {
    const [outing] = await tx`select unit from outings where id=${outingId} for update`;
    if (!outing || !user || !canOperate(user,outing.unit)) return { error: 'No tenés permiso para gestionar esta salida.' };
    return queueReportReminder(tx,outingId,registrationId,user.subject,field(form,'email'));
  });
  if (result.saved) { await dispatchRegistrationUpdates(); revalidatePath('/coordinacion','layout'); }
  return result;
}
