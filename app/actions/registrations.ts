'use server';
import {dispatchRegistrationUpdates} from "../../lib/registration-workflow";
import {redirect} from "next/navigation";
import {staff, canOperate} from "../../lib/auth";
import {sql} from "../../lib/db";
import {uuid} from "../../lib/registration";
import {revalidatePath} from "next/cache";
import {type FormResult} from "../../lib/form-result";
import {manageStaffEntry} from "../../lib/staff-entry-management";
import {manageLegacyEntry} from "../../lib/legacy-entry-management";
import {addRegistrationRecord, editRegistrationRecord} from "../../lib/staff-registration-cases";
import {findStaffRegistrationVolunteers, readEditableRegistration, readStaffRegistrationDetail} from "../../lib/staff-registration-queries";

export async function manageEntry(id: string, fromList: boolean, filter: string, form: FormData) {
  if (!uuid(id)) return;
  const user = await staff();
  const result=await sql.begin(tx=>manageLegacyEntry(tx,id,fromList,filter,form,user));
  await dispatchRegistrationUpdates();
  redirect(result?.back || '/coordinacion');
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
  const user=await staff();
  if(!user||!uuid(id))return {error:'No tenés permiso para gestionar esta inscripción.'};
  const result=await sql.begin(tx=>manageStaffEntry(tx,id,form,{actor:user.subject,canOperate:unit=>canOperate(user,unit)}));
  if(result.saved){await dispatchRegistrationUpdates();revalidatePath('/coordinacion','layout');revalidatePath('/');}
  return result;
}

export async function loadRegistrationDetail(id: string) {
  const user = await staff();
  if (!uuid(id)) return { error: 'Inscripción inválida.' };
  return readStaffRegistrationDetail(sql,user,id);
}
