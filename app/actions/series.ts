'use server';
import {validateCommonSeries, validateManualSeries} from "../../lib/outing-form-validation";
import {type FormResult} from "../../lib/form-result";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {allows, canOperate, requireStaff, staff, staffScope} from "../../lib/auth";
import {sql} from "../../lib/db";
import {field, uuid} from "../../lib/registration";
import {saveManualSeries, saveCommonSeries, saveHomepageFeature} from "../../lib/outing-series";

export async function createOutingCollection(_previous: FormResult, form: FormData):Promise<FormResult> {
  const user = await staff();
  const general = canOperate(user);
  const scopes = staffScope(user).units;
  requireStaff(user, general || scopes.length > 0);
  const name = field(form, 'name');
  const description = field(form, 'description');
  const selected = [...new Set(form.getAll('outing').map(String))];
  const errors=validateManualSeries(form);if(selected.some(id=>!uuid(id)))errors.outing='Seleccioná salidas válidas.';if(Object.keys(errors).length)return {fieldErrors:errors};

  const id=await sql.begin(tx=>saveManualSeries(tx,selected,name,description,user,general,scopes));
  if (!id) return {error:'Una de las salidas seleccionadas ya no está disponible para tu rol. Revisá la selección.'};
  return {saved:true,destination:`/coordinacion/colecciones/manuales/${id}?confirmacion=serie`};
}

export async function updateAutomaticCollection(id: string, form: FormData) {
  const result=await saveAutomaticCollection(id,form);
  const back=`/coordinacion/colecciones/automaticas/${id}`;
  if(!result.saved)return result;
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

export async function setHomepageFeature(kind: 'outing' | 'request', id: string, form: FormData) {
  if (!uuid(id) || !['outing','request'].includes(kind)) return;
  const user = await staff();
  const clear = field(form,'action') === 'retirar';
  const back = kind === 'outing' ? `/coordinacion/salidas/${id}` : `/coordinacion/colecciones/automaticas/${id}`;
  const error=await sql.begin(tx=>saveHomepageFeature(tx,kind,id,user,clear));
  if (!error) revalidatePath('/');
  redirect(`${back}${error ? `?destacadaError=${encodeURIComponent(error)}` : `?confirmacion=${field(form,'action') === 'retirar' ? 'automatica' : 'destacada'}`}#destacada`);
}
