/** Treat successful HTTP responses as untrusted data too. Never include payloads in errors. */
export function graphAccessToken(value){
  const token=value&&!Array.isArray(value)&&typeof value==='object'?value.access_token:undefined;
  if(typeof token!=='string'||!token.trim()||/[\s\u0000-\u001f\u007f]/u.test(token))throw Error('Microsoft devolvió una respuesta de autenticación inválida.');
  return token;
}
export function graphItemId(value){
  const id=value&&!Array.isArray(value)&&typeof value==='object'?value.id:undefined;
  if(typeof id!=='string'||!id.trim()||/[\u0000-\u001f\u007f]/u.test(id))throw Error('SharePoint no devolvió el identificador de la foto.');
  return id;
}
