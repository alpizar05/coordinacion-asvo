'use server';
import {saveRegistryGrant} from "../../lib/registry-mutations";
import {type FormResult} from "../../lib/form-result";
import {revalidatePath} from "next/cache";
import {allows, staff} from "../../lib/auth";
import {demo, sql} from "../../lib/db";

export async function grant(form: FormData):Promise<FormResult> {
 const user=await staff();if(!user||!allows(user,'permissions.manage'))return {error:'No tenés permiso para administrar accesos.'};
 const result=await sql.begin(tx=>saveRegistryGrant(tx,form,user.subject,demo));
 if(result.saved)revalidatePath('/coordinacion/administracion');return result;
}
