'use server';
import {validateCommonSeries, validateManualSeries} from "../../lib/outing-form-validation";
import {type FormResult} from "../../lib/form-result";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {allows, canOperate, requireStaff, staff, staffScope} from "../../lib/auth";
import {sql} from "../../lib/db";
import {field, uuid} from "../../lib/registration";
import {saveManualSeries, saveCommonSeries, saveHomepageFeature,type ManualSeriesCreateResult} from "../../lib/outing-series";

export async function createOutingCollection(_previous: FormResult, form: FormData):Promise<ManualSeriesCreateResult> {
  try {
    const user = await staff();
    const general = canOperate(user);
    const scopes = staffScope(user).units;
    if(!user||(!general&&!scopes.length))return {error:'No tenés permiso para crear convocatorias en serie.'};
    const name = field(form, 'name');
    const description = field(form, 'description');
    const selected = [...new Set(form.getAll('outing').map(String))];
    const errors=validateManualSeries(form);if(selected.some(id=>!uuid(id)))errors.outing='Seleccioná salidas válidas.';if(Object.keys(errors).length)return {fieldErrors:errors};
    const result=await sql.begin(tx=>saveManualSeries(tx,selected,name,description,user,general,scopes));
    if(result.saved !== true)return result;
    return {saved:true,destination:`/coordinacion/colecciones/manuales/${result.id}?confirmacion=serie`};
  } catch {
    return {error:'No se pudo crear la serie. La selección y los datos se conservan para reintentar.'};
  }
}

export async function updateAutomaticCollection(id: string, form: FormData):Promise<FormResult> {
  let result:FormResult;
  try{result=await saveAutomaticCollection(id,form);}catch{return {error:'No se pudo actualizar la convocatoria en serie. Tus datos se conservan para reintentar.'};}
  const back=`/coordinacion/colecciones/automaticas/${id}`;
  if(result.saved !== true)return result;
  redirect(`${back}?guardado=1`);
}

export async function saveAutomaticCollection(id: string, form: FormData): Promise<FormResult> {
  if (!uuid(id)) return {error:'Convocatoria inválida.'};
  const user = await staff();
  requireStaff(user, allows(user,'operations.read'));
  const validation=validateCommonSeries(form);if(Object.keys(validation).length)return {fieldErrors:validation};
  const back = `/coordinacion/colecciones/automaticas/${id}`;
  const outcome=await sql.begin(tx=>saveCommonSeries(tx,id,form,user));
  if (!outcome.saved) return outcome;
  revalidatePath(back); revalidatePath(`/colecciones/${id}`); revalidatePath('/');
  return {saved:true};
}

export async function setHomepageFeature(kind: 'outing' | 'request', id: string, form: FormData):Promise<never> {
  const valid = uuid(id) && ['outing','request'].includes(kind);
  const clear = field(form,'action') === 'retirar';
  const back = valid ? kind === 'outing' ? `/coordinacion/salidas/${id}` : `/coordinacion/colecciones/automaticas/${id}` : '/coordinacion/convocatorias';
  let result:FormResult;
  if (!valid) result={error:'La convocatoria no es válida.'};
  else try {
    const user = await staff();
    result=await sql.begin(tx=>saveHomepageFeature(tx,kind,id,user,clear));
  } catch {
    result={error:'No se pudo actualizar la destacada. Volvé a intentarlo.'};
  }
  if (result.saved === true) {
    revalidatePath('/');
    redirect(`${back}?confirmacion=${clear ? 'automatica' : 'destacada'}#destacada`);
  }
  redirect(`${back}?destacadaError=${encodeURIComponent(result.error || 'No se pudo confirmar el cambio de destacada. Volvé a intentarlo.')}#destacada`);
}
