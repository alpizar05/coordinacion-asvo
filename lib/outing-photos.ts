import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { demo } from './db';
import { graphDiagnostic } from './graph-diagnostics';

export async function preparePhoto(file: File) {
  if (file.size < 1 || file.size > 3 * 1024 * 1024) throw new Error('Elegí una imagen de hasta 3 MB.');
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

export async function storeOriginal(photo: Awaited<ReturnType<typeof preparePhoto>>) {
  if (demo) return { drive: null, item: null };
  const drive = process.env.SHAREPOINT_PHOTO_DRIVE_ID;
  const folder = process.env.SHAREPOINT_PHOTO_FOLDER_ID;
  const tenant = process.env.GRAPH_TENANT_ID;
  const client = process.env.GRAPH_CLIENT_ID;
  const secret = process.env.GRAPH_CLIENT_SECRET;
  if (!drive || !folder || !tenant || !client || !secret) {
    console.error('[sharepoint][diagnostic]', JSON.stringify({ stage: 'configuration', missing:
      Object.entries({ SHAREPOINT_PHOTO_DRIVE_ID: drive, SHAREPOINT_PHOTO_FOLDER_ID: folder,
        GRAPH_TENANT_ID: tenant, GRAPH_CLIENT_ID: client, GRAPH_CLIENT_SECRET: secret })
        .filter(([,value]) => !value).map(([key]) => key) }));
    throw new Error('Configurá la carpeta privada de fotos en SharePoint.');
  }
  const token = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: client, client_secret: secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(error => {
    console.error('[sharepoint][diagnostic]', JSON.stringify({ stage: 'sharepoint-auth', networkFailure: true,
      timeout: error instanceof Error && error.name === 'TimeoutError' }));
    throw new Error('No se pudo conectar con Microsoft.');
  });
  if (!token.ok) {
    await graphDiagnostic('sharepoint-auth', token);
    throw new Error('No se pudo acceder a SharePoint.');
  }
  const { access_token } = await token.json();
  const name = `${randomUUID()}.${photo.format}`;
  const response = await fetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(drive)}/items/${encodeURIComponent(folder)}:/${name}:/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': `image/${photo.format}` },
    body: photo.original,
    signal: AbortSignal.timeout(12000),
  }).catch(error => {
    console.error('[sharepoint][diagnostic]', JSON.stringify({ stage: 'sharepoint-upload', networkFailure: true,
      timeout: error instanceof Error && error.name === 'TimeoutError' }));
    throw new Error('No se pudo conectar con SharePoint.');
  });
  if (!response.ok) {
    await graphDiagnostic('sharepoint-upload', response);
    throw new Error('No se pudo guardar el original en SharePoint.');
  }
  const { id } = await response.json();
  if (typeof id !== 'string') throw new Error('SharePoint no devolvió el identificador de la foto.');
  return { drive, item: id };
}
