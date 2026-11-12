'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '../../../../lib/db';
import { field } from '../../../../lib/registration';
import type {FormResult} from '../../../../lib/form-result';
import { saveOutingReport, type ReportErrors, type ReportValues } from '../../../../lib/outing-report';

export async function submitReport(token: string, _previous: FormResult, form: FormData): Promise<FormResult> {
  const values = { ...Object.fromEntries(['location','activity','starts','ends','actions','host','observations'].map(key => [key,field(form,key)])), labour: form.getAll('labour').map(String) } as ReportValues;
  const mode = field(form,'intent') === 'borrador' ? 'borrador' : 'finalizar';
  const attended = form.getAll('attended').map(String);
  let result;
  try { result = await sql.begin(tx => saveOutingReport(tx,token,values,attended,field(form,'accuracy') === 'on',form.getAll('roster').map(String),mode,field(form,'version'))); }
  catch { return {error:'No se pudo guardar el informe. Tus datos siguen en el formulario; volvé a intentarlo.'}; }
  if('error' in result&&result.error)return {error:result.error};
  if (result.errors) return {fieldErrors:result.errors};
  revalidatePath('/coordinacion','layout');
  revalidatePath(`/resumen-salida/${token}`);
  return {saved:true,destination:`/resumen-salida/${token}/informe?${mode==='borrador'?'borrador=1':'enviado=1'}`};
}
