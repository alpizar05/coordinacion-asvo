'use server';
import {headers} from 'next/headers';
import {validPrivateToken} from '../../lib/authorization';
import {trustedClientAddress} from '../../lib/security-rules.mjs';
import {consumePrivateBudget,rateLimitMessage} from '../../lib/abuse-limits';
import {revalidatePath} from "next/cache";
import {staff} from "../../lib/auth";
import {sql} from "../../lib/db";
import {field, uuid} from "../../lib/registration";
import {type FormResult} from "../../lib/form-result";
import {reportSubmissionResult, type ReportSubmissionResult} from '../../lib/report-result';
import {saveOutingReport, type ReportValues} from "../../lib/outing-report";
import {reconcileStaffAttendance} from "../../lib/staff-report-cases";

export async function reconcileAttendance(outingId: string, volunteerId: string, form: FormData) {
  const user = await staff();
  if (!uuid(outingId) || !uuid(volunteerId)) return {error:'Salida o persona inválida.'};
  const result=await sql.begin(tx=>reconcileStaffAttendance(tx,outingId,volunteerId,form,user));
  if (result.saved) revalidatePath('/coordinacion','layout');
  return result;
}

export async function submitReport(token: string, _previous: FormResult, form: FormData): Promise<ReportSubmissionResult> {
  const values = { ...Object.fromEntries(['location','activity','starts','ends','actions','host','observations'].map(key => [key,field(form,key)])), labour: form.getAll('labour').map(String) } as ReportValues;
  const mode = field(form,'intent') === 'borrador' ? 'borrador' : 'finalizar';
  const attended = form.getAll('attended').map(String);
  let result;
  try {
    if(!validPrivateToken(token))return {error:'El enlace no es válido.'};
    const h=await headers();
    if(!await consumePrivateBudget(sql,'report',token,trustedClientAddress(process.env,h.get('x-vercel-forwarded-for'))))return {error:rateLimitMessage};
    result = await sql.begin(tx => saveOutingReport(tx,token,values,attended,field(form,'accuracy') === 'on',form.getAll('roster').map(String),mode,field(form,'version'))); }
  catch { return {error:'No se pudo guardar el informe. Tus datos siguen en el formulario; volvé a intentarlo.'}; }
  const response = reportSubmissionResult(result,token,mode);
  if (response.saved !== true) return response;
  revalidatePath('/coordinacion','layout');
  revalidatePath(`/resumen-salida/${token}`);
  return response;
}
