'use server';
import {dispatchRegistrationUpdates} from "../../lib/registration-workflow";
import {redirect} from "next/navigation";
import {staff, canOperate} from "../../lib/auth";
import {sql} from "../../lib/db";
import {uuid} from "../../lib/registration";
import {revalidatePath} from "next/cache";
import {type FormResult} from "../../lib/form-result";
import {manageStaffEntry} from "../../lib/staff-entry-management";
import type {LegacyEntryResult} from '../../lib/legacy-operation-result';
import {manageLegacyEntry} from "../../lib/legacy-entry-management";
import {addRegistrationRecord, editRegistrationRecord} from "../../lib/staff-registration-cases";
import {findStaffRegistrationVolunteers, readEditableRegistration, readStaffRegistrationDetail} from "../../lib/staff-registration-queries";

export async function manageEntry(id: string, fromList: boolean, filter: string, form: FormData):Promise<never> {
  if (!uuid(id))redirect('/coordinacion/inscripciones?error='+encodeURIComponent('La inscripción no es válida.'));
  let result:LegacyEntryResult;
  try{const user=await staff();result=await sql.begin(tx=>manageLegacyEntry(tx,id,fromList,filter,form,user));}
  catch{result={error:'No se pudo gestionar la inscripción.',back:'/coordinacion/inscripciones?error='+encodeURIComponent('No se pudo gestionar la inscripción.')};}
  if(result.saved === true||result.flushUpdates === true)await dispatchRegistrationUpdates();
  redirect(result.back);
}

export async function findRegistrationVolunteers(outingId: string, query: string) {
  const user = await staff();
  if (!uuid(outingId)) return { error: 'Salida inválida.', people: [] };
  return findStaffRegistrationVolunteers(sql,user,outingId,query);
}

export async function addRegistration(outingId: string, form: FormData): Promise<FormResult & {status?:string}> {
  const user = await staff();
  if (!uuid(outingId)) return {error:'La salida no está disponible.'};
  const result=await sql.begin(tx=>addRegistrationRecord(tx,outingId,form,user));
  if (result.saved) {
    await dispatchRegistrationUpdates();
    revalidatePath(`/coordinacion/salidas/${outingId}`);
    revalidatePath('/coordinacion/inscripciones');
    revalidatePath('/');
  }
  return result;
}

export async function loadEditableRegistration(id: string) {
  const user = await staff();
  if (!uuid(id)) return { error: 'Inscripción inválida.' };
  return readEditableRegistration(sql,user,id);
}

export async function saveEditedRegistration(id: string, form: FormData): Promise<FormResult> {
  const user = await staff();
  if (!uuid(id)) return { error: 'Inscripción inválida.' };
  const result=await sql.begin(tx=>editRegistrationRecord(tx,id,form,user));
  if (result.saved) { await dispatchRegistrationUpdates(); revalidatePath('/coordinacion','layout'); revalidatePath('/'); }
  return result;
}

export async function manageRegistration(id:string,form:FormData):Promise<FormResult>{
  let result:FormResult;
  try {
    const user=await staff();
    if(!user||!uuid(id))return {error:'No tenés permiso para gestionar esta inscripción.'};
    result=await sql.begin(tx=>manageStaffEntry(tx,id,form,{actor:user.subject,canOperate:unit=>canOperate(user,unit)}));
  } catch {
    return {error:'No se pudo gestionar la inscripción. Tus datos se conservan para reintentar.'};
  }
  if(result.saved === true){await dispatchRegistrationUpdates();revalidatePath('/coordinacion','layout');revalidatePath('/');}
  return result;
}

export async function loadRegistrationDetail(id: string) {
  const user = await staff();
  if (!uuid(id)) return { error: 'Inscripción inválida.' };
  return readStaffRegistrationDetail(sql,user,id);
}
