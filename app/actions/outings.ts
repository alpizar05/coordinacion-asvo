'use server';
import {dispatchRegistrationUpdates} from "../../lib/registration-workflow";
import {splitStaffGroup} from "../../lib/staff-group";
import {type FormResult} from "../../lib/form-result";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {canOperate, staff} from "../../lib/auth";
import {PhotoUploadError} from "../../lib/photo-upload-workflow";
import {OutingCreationError} from "../../lib/outing-creation";
import {sql} from "../../lib/db";
import {field, uuid} from "../../lib/registration";
import {legacyResultMessage,type LegacyOutingResult} from '../../lib/legacy-operation-result';
import {manageOutingRecord} from "../../lib/staff-outing-management";
import {logSafeFailure} from '../../lib/server-config.mjs';
import {createStaffOuting} from "../../lib/create-staff-outing";

export async function createOuting(form: FormData): Promise<FormResult & {target?:string}> {
  try {
    const user=await staff();if(!user)throw Error('Acceso denegado.');
    return { saved:true,destination: await createStaffOuting(sql,user,form) };
  } catch (error) {
    if(error instanceof PhotoUploadError)return error.kind==='provider'?{error:error.message}:{fieldErrors:error.fieldErrors};
    if (error instanceof OutingCreationError) return error.fieldErrors?{fieldErrors:error.fieldErrors}:{error:error.target?undefined:error.message,fieldErrors:error.target?{[error.target]:error.message}:undefined,target:error.target};
    logSafeFailure('outings.create',error);
    return { error: 'No se pudo crear la convocatoria. Revisá los datos e intentá de nuevo.' };
  }
}

export async function manageOuting(id: string, form: FormData):Promise<never> {
  if (!uuid(id)) redirect('/coordinacion/convocatorias?error='+encodeURIComponent('La convocatoria no es válida.'));
  let result:LegacyOutingResult;
  try{const user=await staff();result=await sql.begin(tx=>manageOutingRecord(tx,id,form,user));}
  catch{result={error:'No se pudo gestionar la convocatoria. Volvé a intentarlo.'};}
  const saved=result.saved === true;
  if(saved)await dispatchRegistrationUpdates();
  if (result.saved === true && result.outcome === 'deleted') redirect('/coordinacion/convocatorias?confirmacion=eliminada#salidas');
  const back = `/coordinacion/salidas/${id}`;
  const action = field(form, 'action');
  if (result.saved === true && result.outcome === 'completed') redirect(`${back}?completada=1`);
  const message=saved?'':legacyResultMessage(result);
  if (action === 'agrupación') redirect(`${back}${saved ? '?confirmacion=agrupacion' : `?error=${encodeURIComponent(message)}`}#agrupaciones`);
  if (saved && action === 'cancelar-salida') redirect(`${back}?confirmacion=cancelada`);
  const query = new URLSearchParams({ editar: '1' });
  if (saved) query.set('confirmacion','salida');
  if (result.issue === 'unit-conflict') {
    query.set('error', message);
    query.set('unidadPropuesta', field(form, 'unit'));
  } else if (!saved) query.set('error', message);
  const terminalAction = ['eliminar', 'cancelar-salida'].includes(action);
  if (terminalAction && !saved) query.set('gestion', '1');
  const sections: Record<string, string> = {
    completar: '#completar-salida', datos: '#datos-salida', informacion: '#informacion-salida', solicitud: '#solicitud-apoyo',
    'heredar-fotos': '#fotos', fechas: '#fechas', cupo: '#cupos', visibilidad: '#visibilidad',
  };
  const anchor = terminalAction ? '#gestionar-salida' : sections[action] ?? (!saved ? '#fotos' : '');
  redirect(`${back}?${query}${anchor}`);
}

export async function splitOutingGroup(id: string, start: string, end: string, form: FormData): Promise<FormResult> {
  if (!uuid(id)) return {error:'La salida no está disponible.'};
  const user=await staff();
  if(!user)return {error:'No tenés permiso para gestionar esta salida.'};
  const result=await sql.begin(tx=>splitStaffGroup(tx,id,start,end,form,{actor:user.subject,canOperate:unit=>canOperate(user,unit)}));
  if(!result.saved)return result;
  await dispatchRegistrationUpdates();
  revalidatePath(`/coordinacion/salidas/${id}`);
  return {saved:true,destination:`/coordinacion/salidas/${id}?grupoCreado=${result.id}#agrupaciones`};
}
