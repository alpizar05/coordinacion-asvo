'use server';
import {randomBytes} from "node:crypto";
import {type FormResult} from "../../lib/form-result";
import {staff} from "../../lib/auth";
import {appUrl, sql} from "../../lib/db";
import {field, identification, uuid} from "../../lib/registration";
import {revalidatePath} from "next/cache";
import {dispatchRegistrationUpdates} from "../../lib/registration-workflow";
import {createStaffInvitation, generateStaffBrief, revokeStaffBrief, queueStaffReportReminder, type BriefLinkResult} from "../../lib/staff-communications";

export async function createOutingInvitation(id: string, _previous: FormResult & {link?:string}, form: FormData): Promise<FormResult & {link?:string}> {
  if (!uuid(id)) return { error: 'La convocatoria no está disponible.' };
  const user = await staff();
  const number = identification(field(form, 'identification'));
  if(!/^[A-Z0-9]{4,30}$/.test(number))return {fieldErrors:{identification:'Ingresá una identificación válida del registro.'}};
  const token = randomBytes(32).toString('base64url');
  const link = `${appUrl()}/convocatorias/${id}?invitacion=${token}`;
  return sql.begin(tx=>createStaffInvitation(tx,id,number,token,link,user));
}

export async function generateBrief(id: string, _previous: FormResult & {link?:string}, form: FormData): Promise<BriefLinkResult> {
  const lead = field(form,'lead');
  const fieldErrors = !uuid(lead) ? {lead:'Seleccioná una persona asignada como 70.'} : undefined;
  const error = !uuid(id) ? 'La salida no es válida.' : undefined;
  if (error || fieldErrors) return {error,fieldErrors};
  try {
    const user = await staff();
    if (!user) return {error:'No tenés permiso para generar enlaces de esta salida.'};
    const token = randomBytes(32).toString('base64url');
    const link = `${appUrl()}/resumen-salida/${token}`;
    const result=await sql.begin(tx=>generateStaffBrief(tx,id,lead,token,user));
    if (result.saved !== true) return result;
    revalidatePath(`/coordinacion/salidas/${id}/resumen`);
    return {saved:true,link};
  } catch {
    return {error:'No se pudo generar el enlace. Los datos se conservan para reintentar.'};
  }
}

export async function revokeBrief(id: string): Promise<FormResult> {
  if (!uuid(id)) return {error:'La salida no es válida.'};
  try {
    const user = await staff();
    if (!user) return {error:'No tenés permiso para revocar enlaces de esta salida.'};
    const result=await sql.begin(tx=>revokeStaffBrief(tx,id,user));
    if (result.saved !== true) return result;
    revalidatePath(`/coordinacion/salidas/${id}/resumen`);
    return {saved:true};
  } catch {
    return {error:'No se pudieron revocar los enlaces. Volvé a intentarlo.'};
  }
}

export async function sendReportReminder(outingId: string, registrationId: string, form: FormData) {
  const user = await staff();
  if (!uuid(outingId) || !uuid(registrationId)) return { error: 'La salida no es válida.' };
  const result=await sql.begin(tx=>queueStaffReportReminder(tx,outingId,registrationId,form,user));
  if (result.saved) { await dispatchRegistrationUpdates(); revalidatePath('/coordinacion','layout'); }
  return result;
}
