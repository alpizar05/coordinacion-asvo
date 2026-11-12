'use server';
import {staff,canOperate} from '../../lib/auth';
import {sql} from '../../lib/db';
import {uuid} from '../../lib/registration';
import {saveOutingDecision} from '../../lib/outing-decision';
import {dispatchRegistrationUpdates} from '../../lib/registration-workflow';
import {revalidatePath} from 'next/cache';
import type {FormResult} from '../../lib/form-result';
export async function decideOuting(id:string,form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!uuid(id))return {error:'No tenés permiso para gestionar esta salida.'};
 const result=await sql.begin(tx=>saveOutingDecision(tx,id,form,{actor:user.subject,canOperate:unit=>canOperate(user,unit)}));
 if(result.saved){await dispatchRegistrationUpdates();revalidatePath('/coordinacion','layout');revalidatePath('/');}return result;
}
