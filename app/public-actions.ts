'use server';

import { randomUUID } from 'node:crypto';
import { cookies,headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '../lib/db';
import { uuid } from '../lib/registration';
import { dispatchRegistrationUpdates } from '../lib/registration-workflow';
import { createRegistrationReceipt,receiptCookie } from '../lib/registration-receipt';
import { receivePublicRegistration,changePrivateRegistration } from '../lib/public-registration';
import type { RegistrationActionResult } from '../lib/registration-validation';

export async function register(outingId:string,schedule:string,token:string,form:FormData):Promise<RegistrationActionResult>{
  if(!uuid(outingId))return {error:'La convocatoria no está disponible.'};
  const header=await headers();
  const ip=header.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'local';
  try{
    const result=await sql.begin(async tx=>{
      const received=await receivePublicRegistration(tx,outingId,schedule,token,form,ip);
      if(!received.saved||!('id' in received))return received;
      return {...received,receipt:await createRegistrationReceipt(tx,received.id,received.status)};
    });
    if(!result.saved||!('receipt' in result))return result;
    (await cookies()).set(receiptCookie(outingId),result.receipt,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});
    await dispatchRegistrationUpdates();
    return {saved:true,destination:`/convocatorias/${outingId}?recibido=1&resultado=${randomUUID()}#inscripcion`};
  }catch{
    return {error:'No se pudo completar el envío. Tus datos se conservan. Si recibiste un correo de confirmación, consultá su enlace antes de reintentar.'};
  }
}
export async function submitPrivateRegistration(token:string,form:FormData):Promise<RegistrationActionResult>{
  if(!/^[\w-]{43}$/.test(token))return {error:'El enlace no es válido. Contactá a Coordinación.'};
  try{
    const result=await sql.begin(tx=>changePrivateRegistration(tx,token,form));
    if(result.saved)await dispatchRegistrationUpdates();
    return result;
  }catch{return {error:'No se pudo aplicar el cambio. Tus datos se conservan para reintentar.'};}
}
/** Compatibility for existing links/tests; new forms consume structured errors without redirecting. */
export async function privateAction(token:string,form:FormData){
  const result=await submitPrivateRegistration(token,form);
  redirect(`/privado/${token}?${result.saved?'actualizada=1':'error=1'}`);
}
