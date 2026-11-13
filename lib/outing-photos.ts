import {graphAccessToken,graphItemId} from './graph-response.mjs';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { demo } from './db';
import { graphDiagnostic } from './graph-diagnostics';

export async function preparePhoto(file: File) {
  if (!(file instanceof File) || file.size < 1 || file.size > 3 * 1024 * 1024) throw new Error('Elegí una imagen de hasta 3 MB.');
  const original = await file.arrayBuffer();
  const source = sharp(original, { limitInputPixels: 24_000_000 });
  const { format, pages } = await source.metadata();
  if (!format || !['jpeg', 'png', 'webp'].includes(format) || (pages ?? 1) > 1) {
    throw new Error('Usá una foto JPG, PNG o WebP estática.');
  }
  const [thumbnail, display] = await Promise.all([
    source.clone().autoOrient().resize(560, 350, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer(),
    source.clone().autoOrient().resize(1440, 1100, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
  ]);
  return { original, format, thumbnail, display };
}

export function graphPhotoStore(options:{fetch?:typeof fetch;config?:()=>{tenant:string;client:string;secret:string;drive:string;folder:string};timeoutMs?:number;demo?:boolean}={}):import('./photo-upload-workflow').PhotoStore {
 const request=options.fetch??fetch,timeout=options.timeoutMs??12000;
 const config=options.config??(()=>{const c={tenant:process.env.GRAPH_TENANT_ID||'',client:process.env.GRAPH_CLIENT_ID||'',secret:process.env.GRAPH_CLIENT_SECRET||'',drive:process.env.SHAREPOINT_PHOTO_DRIVE_ID||'',folder:process.env.SHAREPOINT_PHOTO_FOLDER_ID||''};if(Object.values(c).some(value=>!value))throw Error('Configurá la carpeta privada de fotos en SharePoint.');return c;});
 async function token(){const c=config();const response=await request(`https://login.microsoftonline.com/${encodeURIComponent(c.tenant)}/oauth2/v2.0/token`,{method:'POST',body:new URLSearchParams({client_id:c.client,client_secret:c.secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(Math.min(timeout,8000))});if(!response.ok){await graphDiagnostic('sharepoint-auth',response);throw Error('No se pudo acceder a SharePoint.');}return graphAccessToken(await response.json());}
 const path=(target:import('./photo-upload-workflow').PhotoTarget)=>`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(target.drive)}/items/${encodeURIComponent(target.folder)}:/${encodeURIComponent(target.name)}`;
 return {
  target(){if(options.demo??demo)return null;const c=config();return {drive:c.drive,folder:c.folder};},
  async put(photo,target){const access=await token();const response=await request(path(target)+':/content',{method:'PUT',headers:{Authorization:`Bearer ${access}`,'Content-Type':`image/${photo.format}`},body:photo.original,signal:AbortSignal.timeout(timeout)});if(!response.ok){await graphDiagnostic('sharepoint-upload',response);throw Error('No se pudo guardar el original en SharePoint.');}return {drive:target.drive,item:graphItemId(await response.json())};},
  async find(target){const access=await token();const response=await request(path(target),{headers:{Authorization:`Bearer ${access}`},signal:AbortSignal.timeout(timeout)});if(response.status===404)return null;if(!response.ok)throw Error('No se pudo consultar el original pendiente.');const data:unknown=await response.json();const row=data as {id?:unknown;name?:unknown;eTag?:unknown;parentReference?:{id?:unknown}};if(!row||row.name!==target.name||row.parentReference?.id!==target.folder||typeof row.eTag!=='string'||!row.eTag||/[\r\n]/.test(row.eTag))throw Error('SharePoint devolvió metadatos inesperados.');return {item:graphItemId(row),etag:row.eTag};},
  async remove(target,item,etag){const access=await token();const response=await request(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(target.drive)}/items/${encodeURIComponent(item)}`,{method:'DELETE',headers:{Authorization:`Bearer ${access}`,'If-Match':etag},signal:AbortSignal.timeout(timeout)});if(!response.ok&&response.status!==404)throw Error('No se pudo limpiar el original pendiente.');},
 };
}
/** Compatibility for explicit tooling. Application writes use the tracked workflow. */
export async function storeOriginal(photo:Awaited<ReturnType<typeof preparePhoto>>){const store=graphPhotoStore(),target=store.target();if(!target)return {drive:null,item:null};return store.put(photo,{...target,name:`${randomUUID()}.${photo.format}`});}
