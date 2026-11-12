'use server';
import { revalidatePath } from 'next/cache';
import { staff,canOperate } from '../../lib/auth';
import { sql } from '../../lib/db';
import { uuid } from '../../lib/registration';
import { manageStaffEntry } from '../../lib/staff-entry-management';
import { dispatchRegistrationUpdates } from '../../lib/registration-workflow';
import type { FormResult } from '../../lib/form-result';

export async function manageRegistration(id:string,form:FormData):Promise<FormResult>{
  const user=await staff();
  if(!user||!uuid(id))return {error:'No tenés permiso para gestionar esta inscripción.'};
  const result=await sql.begin(tx=>manageStaffEntry(tx,id,form,{actor:user.subject,canOperate:unit=>canOperate(user,unit)}));
  if(result.saved){await dispatchRegistrationUpdates();revalidatePath('/coordinacion','layout');revalidatePath('/');}
  return result;
}
