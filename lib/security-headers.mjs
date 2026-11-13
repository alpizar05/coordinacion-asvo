/** Partial enforcing CSP deliberately leaves script/style handling to Next; strict nonces need a separate rollout. */
export function securityHeaders(env={}){
 const headers=[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'no-referrer'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
  {key:'Content-Security-Policy',value:"object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://login.microsoftonline.com"},
 ];
 if(env.NODE_ENV==='production'&&/^https:\/\//.test(env.APP_URL||''))headers.push({key:'Strict-Transport-Security',value:'max-age=31536000'});
 return headers;
}
export const privateHeaders=[{key:'Cache-Control',value:'private, no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'}];
export const privateRequestLogPatterns=[/^\/privado(?:\/|$)/,/^\/resumen-salida(?:\/|$)/,/[?&]invitacion=/];
