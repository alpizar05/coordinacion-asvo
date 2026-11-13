'use server';
import {randomBytes} from "node:crypto";
import {type FormResult} from "../../lib/form-result";
import {staff} from "../../lib/auth";
import {appUrl, sql} from "../../lib/db";
import {field, identification, uuid} from "../../lib/registration";
import {revalidatePath} from "next/cache";
import {dispatchRegistrationUpdates} from "../../lib/registration-workflow";
import {createStaffInvitation, generateStaffBrief, revokeStaffBrief, queueStaffReportReminder} from "../../lib/staff-communications";

export async function createOutingInvitation(id: string, _previous: FormResult & {link?:string}, form: FormData): Promise<FormResult & {link?:string}> {
  if (!uuid(id)) return { error: 'La convocatoria no está disponible.' };
  const user = await staff();
  const number = identification(field(form, 'identification'));
  if(!/^[A-Z0-9]{4,30}$/.test(number))return {fieldErrors:{identification:'Ingresá una identificación válida del registro.'}};
  const token = randomBytes(32).toString('base64url');
  const link = `${appUrl()}/convocatorias/${id}?invitacion=${token}`;
  return sql.begin(tx=>createStaffInvitation(tx,id,number,token,link,user));
}

export async function generateBrief(id: string, _previous: FormResult & {link?:string}, form: FormData): Promise<FormResult & {link?:string}> {
  if (!uuid(id)) return { error: 'La salida no es válida.' };
  const user = await staff();
  const lead = field(form,'lead');
  if (!uuid(lead)) return { fieldErrors:{lead:'Seleccioná una persona asignada como 70.'} };
  const token = randomBytes(32).toString('base64url');
  const result=await sql.begin(tx=>generateStaffBrief(tx,id,lead,token,user));
  revalidatePath(`/coordinacion/salidas/${id}/resumen`);
  return result ? { error: result } : { saved:true,link: `${appUrl()}/resumen-salida/${token}` };
}

export async function revokeBrief(id: string) {
  if (!uuid(id)) return;
  const user = await staff();
  await sql.begin(tx=>revokeStaffBrief(tx,id,user));
  revalidatePath(`/coordinacion/salidas/${id}/resumen`);
}

export async function sendReportReminder(outingId: string, registrationId: string, form: FormData) {
  const user = await staff();
  if (!uuid(outingId) || !uuid(registrationId)) return { error: 'La salida no es válida.' };
  const result=await sql.begin(tx=>queueStaffReportReminder(tx,outingId,registrationId,form,user));
  if (result.saved) { await dispatchRegistrationUpdates(); revalidatePath('/coordinacion','layout'); }
  return result;
}
