'use server';
import type {FormResult} from '../../../../../lib/form-result';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { staff, canOperate, requireStaff } from '../../../../../lib/auth';
import { appUrl, sql } from '../../../../../lib/db';
import { audit, digest, field, uuid } from '../../../../../lib/registration';

export async function generateBrief(id: string, _previous: FormResult & {link?:string}, form: FormData): Promise<FormResult & {link?:string}> {
  if (!uuid(id)) return { error: 'La salida no es válida.' };
  const user = await staff();
  const lead = field(form,'lead');
  if (!uuid(lead)) return { fieldErrors:{lead:'Seleccioná una persona asignada como 70.'} };
  const token = randomBytes(32).toString('base64url');
  const result = await sql.begin(async tx => {
    const [outing] = await tx`select unit,status from outings where id=${id} for update`;
    requireStaff(user,!!outing && canOperate(user,outing.unit));
    if (!['abierta','confirmada','completada'].includes(outing.status)) return 'No se puede compartir una salida cancelada o en borrador.';
    const [person] = await tx`select id from registrations where id=${lead} and outing_id=${id}
      and status='confirmada' and details->'assigned70'='true'::jsonb`;
    if (!person) return 'La persona debe tener inscripción confirmada y estar asignada como 70.';
    await tx`update outing_brief_links set revoked_at=now() where outing_id=${id} and lead_registration_id=${lead} and revoked_at is null`;
    await tx`insert into outing_brief_links(digest,outing_id,lead_registration_id,created_by) values (${digest(token)},${id},${lead},${user.subject})`;
    await audit(tx,user.subject,'Generó resumen para 70',id,`Inscripción: ${lead}`);
  });
  revalidatePath(`/coordinacion/salidas/${id}/resumen`);
  return result ? { error: result } : { saved:true,link: `${appUrl()}/resumen-salida/${token}` };
}

export async function revokeBrief(id: string) {
  if (!uuid(id)) return;
  const user = await staff();
  await sql.begin(async tx => {
    const [outing] = await tx`select unit from outings where id=${id} for update`;
    requireStaff(user,!!outing && canOperate(user,outing.unit));
    await tx`update outing_brief_links set revoked_at=now() where outing_id=${id} and revoked_at is null`;
    await audit(tx,user.subject,'Revocó enlaces de resumen para 70',id);
  });
  revalidatePath(`/coordinacion/salidas/${id}/resumen`);
}
