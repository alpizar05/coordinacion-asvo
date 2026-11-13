import type {NextRequest} from 'next/server';
import {handlers} from '../../../../lib/auth';
import {demo} from '../../../../lib/db';
import {readAuthConfiguration,logSafeFailure} from '../../../../lib/server-config.mjs';
async function invoke(method:'GET'|'POST',request:NextRequest){
 if(demo)return Response.json({error:'El proveedor está deshabilitado en demo.'},{status:503});
 try{readAuthConfiguration();}catch(error){logSafeFailure('auth',error);return Response.json({error:'Inicio de sesión no configurado.'},{status:503});}
 return handlers[method](request);
}
export async function GET(request:NextRequest){return invoke('GET',request);}
export async function POST(request:NextRequest){return invoke('POST',request);}
