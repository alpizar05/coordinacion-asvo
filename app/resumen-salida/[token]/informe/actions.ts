'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '../../../../lib/db';
import { field } from '../../../../lib/registration';
import { saveOutingReport, type ReportErrors, type ReportValues } from '../../../../lib/outing-report';

export async function submitReport(token: string, _previous: { errors?: ReportErrors }, form: FormData): Promise<{ errors?: ReportErrors }> {
  const values = { ...Object.fromEntries(['location','activity','starts','ends','actions','host','observations'].map(key => [key,field(form,key)])), labour: form.getAll('labour').map(String) } as ReportValues;
  const mode = field(form,'intent') === 'borrador' ? 'borrador' : 'finalizar';
  const attended = form.getAll('attended').map(String);
  let result;
  try { result = await sql.begin(tx => saveOutingReport(tx,token,values,attended,field(form,'accuracy') === 'on',form.getAll('roster').map(String),mode)); }
  catch { return { errors: { form: 'No se pudo guardar el informe. Tus datos siguen en el formulario; volvé a intentarlo.' } }; }
  if (result.errors) return { errors: result.errors };
  revalidatePath('/coordinacion','layout');
  revalidatePath(`/resumen-salida/${token}`);
  redirect(`/resumen-salida/${token}/informe?${mode === 'borrador' ? 'borrador=1' : 'enviado=1'}`);
}
