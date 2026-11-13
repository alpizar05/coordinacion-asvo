'use server';
import {prepareRegistryImport, applyRegistryImport} from "../../lib/registry-import";
import {verifyRegistryPolicy, saveRegistryUnits, saveRegistryIncident} from "../../lib/registry-mutations";
import {type ProfileField} from "../../lib/profile-validation";
import {type FormResult} from "../../lib/form-result";
import {revalidatePath} from "next/cache";
import {allows, staff} from "../../lib/auth";
import {sql} from "../../lib/db";
import {field, uuid} from "../../lib/registration";
import {correctVolunteerProfile} from "../../lib/volunteer-profile";

export async function verifyPolicy(form: FormData):Promise<FormResult> {
 const user=await staff();if(!user||!allows(user,'policies.verify'))return {error:'No tenés permiso para verificar pólizas.'};
 const id=field(form,'volunteer');if(!uuid(id))return {error:'La persona no está disponible.'};
 const result=await sql.begin(tx=>verifyRegistryPolicy(tx,id,form,user.subject));
 if(result.saved)revalidatePath(`/coordinacion/registro/${id}`);return result;
}

export async function importPreview(csv:string){
 const user=await staff();if(!user||!allows(user,'volunteers.import'))return {error:'No tenés permiso para importar voluntariado.'};
 return sql.begin(tx=>prepareRegistryImport(tx,csv,'volunteers'));
}

export async function applyImportRows(form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!allows(user,'volunteers.import'))return {error:'No tenés permiso para importar voluntariado.'};
 const result=await sql.begin(tx=>applyRegistryImport(tx,form,'volunteers',user.subject));
 if(result.saved){revalidatePath('/coordinacion/registro');revalidatePath('/coordinacion/administracion');}return result;
}

export async function editProfile(id: string, form: FormData): Promise<FormResult<ProfileField>> {
  const user = await staff();
  if (!user || !allows(user,'volunteers.correct')) return { error: 'No tenés permiso para corregir esta ficha.' };
  if (!uuid(id)) return { error: 'La persona no está disponible.' };
  const result=await correctVolunteerProfile(sql,id,form,user.subject);
  if(result.saved)revalidatePath(`/coordinacion/registro/${id}`);
  return result;
}

export async function updateVolunteerUnits(id:string,form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!allows(user,'volunteers.units'))return {error:'No tenés permiso para actualizar unidades.'};
 if(!uuid(id))return {error:'La persona no está disponible.'};
 const result=await sql.begin(tx=>saveRegistryUnits(tx,id,form,user.subject));
 if(result.saved)revalidatePath(`/coordinacion/registro/${id}`);return result;
}

export async function previewPolicies(csv:string){
 const user=await staff();if(!user||!allows(user,'policies.import'))return {error:'No tenés permiso para importar pólizas.'};
 return sql.begin(tx=>prepareRegistryImport(tx,csv,'policies'));
}

export async function applyPolicyRows(form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!allows(user,'policies.import'))return {error:'No tenés permiso para importar pólizas.'};
 const result=await sql.begin(tx=>applyRegistryImport(tx,form,'policies',user.subject));
 if(result.saved){revalidatePath('/coordinacion/registro');revalidatePath('/coordinacion/administracion');}return result;
}

export async function recordVolunteerIncident(id:string,form:FormData):Promise<FormResult>{
 const user=await staff();if(!user||!allows(user,'volunteers.incident'))return {error:'No tenés permiso para registrar incidentes.'};
 if(!uuid(id))return {error:'La persona no está disponible.'};
 const result=await sql.begin(tx=>saveRegistryIncident(tx,id,form,user.subject));
 if(result.saved)revalidatePath(`/coordinacion/registro/${id}`);return result;
}
