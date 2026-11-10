'use server';

import { revalidatePath } from 'next/cache';
import { canOperate, staff } from '../../lib/auth';
import { sql } from '../../lib/db';
import { field, uuid } from '../../lib/registration';
import { saveAttendanceResolution } from '../../lib/attendance-reconciliation';

export async function reconcileAttendance(outingId: string, volunteerId: string, form: FormData) {
  const user = await staff();
  if (!uuid(outingId) || !uuid(volunteerId)) return {error:'Salida o persona inválida.'};
  const result = await sql.begin(async tx=>{
    const [outing] = await tx`select unit from outings where id=${outingId} for update`;
    if (!outing || !user || !canOperate(user,outing.unit)) return {error:'No tenés permiso para conciliar esta salida.'};
    return saveAttendanceResolution(tx,outingId,volunteerId,field(form,'version'),field(form,'decision'),field(form,'reason'),user.subject);
  });
  if (result.saved) revalidatePath('/coordinacion','layout');
  return result;
}
