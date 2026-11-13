/** Pure, injected configuration validation. Errors contain keys/codes, never submitted values. */
export class ConfigurationError extends Error {
 constructor(feature,issues){super(`Configuración inválida de ${feature}: ${issues.map(i=>i.key).join(', ')}.`);this.name='ConfigurationError';this.feature=feature;this.issues=issues;}
}
const guid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const isLoopback=host=>['localhost','127.0.0.1','[::1]'].includes(host);
function need(env,key,issues){const value=env[key];if(typeof value!=='string'||!value.trim()||/[\r\n\u0000]/.test(value)){issues.push({key,code:'missing_or_invalid'});return '';}return value;}
function finish(feature,issues,value){if(issues.length)throw new ConfigurationError(feature,issues);return value;}
function urlValue(env,key,protocols,issues){const raw=need(env,key,issues);try{const u=new URL(raw);if(!protocols.includes(u.protocol)||!u.hostname)throw Error();return u;}catch{if(raw)issues.push({key,code:'invalid_url'});return null;}}
export function databaseConfiguration(env){
 const issues=[],u=urlValue(env,'DATABASE_URL',['postgres:','postgresql:'],issues);
 if(u){
  const allowed=new Set(['sslmode','application_name','connect_timeout','channel_binding']);
  if([...u.searchParams.keys()].some(k=>!allowed.has(k)||u.searchParams.getAll(k).length!==1)||!u.pathname||u.pathname==='/')issues.push({key:'DATABASE_URL',code:'unsafe_options_or_database'});
  if(!isLoopback(u.hostname)&&(!u.username||!u.password||!['require','verify-ca','verify-full'].includes(u.searchParams.get('sslmode'))))issues.push({key:'DATABASE_URL',code:'remote_requires_credentials_and_tls'});
 }
 const publicSecrets=Object.keys(env).filter(k=>/^NEXT_PUBLIC_.*(?:DATABASE|PASSWORD|SECRET|TOKEN|GRAPH_|SHAREPOINT_)/.test(k)&&env[k]);
 for(const key of publicSecrets)issues.push({key,code:'public_secret_forbidden'});
 return finish('database',issues,{url:u?.href});
}
export function applicationConfiguration(env){
 const issues=[],u=urlValue(env,'APP_URL',['http:','https:'],issues);
 if(u&&(u.username||u.password||u.search||u.hash||u.pathname!=='/'||(!isLoopback(u.hostname)&&u.protocol!=='https:')))issues.push({key:'APP_URL',code:'unsafe_origin'});
 return finish('application',issues,{origin:u?.origin});
}
export function demoConfiguration(env){
 const issues=[];if(env.ASVO_DEMO!=null&&!['0','1',''].includes(env.ASVO_DEMO))issues.push({key:'ASVO_DEMO',code:'invalid_flag'});
 const enabled=env.ASVO_DEMO==='1';
 if(enabled){
  if(env.NODE_ENV!=='development'||env.VERCEL||env.VERCEL_ENV)issues.push({key:'ASVO_DEMO',code:'local_development_only'});
  try{const u=new URL(databaseConfiguration(env).url);if(!isLoopback(u.hostname))issues.push({key:'DATABASE_URL',code:'demo_requires_loopback'});}catch(error){if(error instanceof ConfigurationError)issues.push(...error.issues);else issues.push({key:'DATABASE_URL',code:'invalid_url'});}
  try{const u=new URL(applicationConfiguration(env).origin);if(!isLoopback(u.hostname))issues.push({key:'APP_URL',code:'demo_requires_loopback'});}catch(error){if(error instanceof ConfigurationError)issues.push(...error.issues);else issues.push({key:'APP_URL',code:'invalid_url'});}
 }
 return finish('demo',issues,{enabled});
}
export function authConfiguration(env){
 const issues=[],id=need(env,'AUTH_MICROSOFT_ENTRA_ID_ID',issues),secret=need(env,'AUTH_MICROSOFT_ENTRA_ID_SECRET',issues),session=need(env,'AUTH_SECRET',issues),issuer=need(env,'AUTH_MICROSOFT_ENTRA_ID_ISSUER',issues);
 const tenant=/^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/i.exec(issuer)?.[1];
 if(id&&!guid.test(id))issues.push({key:'AUTH_MICROSOFT_ENTRA_ID_ID',code:'invalid_uuid'});
 if(issuer&&(!tenant||!guid.test(tenant)))issues.push({key:'AUTH_MICROSOFT_ENTRA_ID_ISSUER',code:'single_tenant_required'});
 if(session&&session.length<32)issues.push({key:'AUTH_SECRET',code:'minimum_32_characters'});
 return finish('auth',issues,{id,secret,session,issuer,tenant});
}
export function graphConfiguration(env,feature){
 if(!['mail','photos'].includes(feature))throw new ConfigurationError('graph',[{key:'feature',code:'unknown_feature'}]);
 const issues=[],tenant=need(env,'GRAPH_TENANT_ID',issues),client=need(env,'GRAPH_CLIENT_ID',issues),secret=need(env,'GRAPH_CLIENT_SECRET',issues);
 for(const[key,value]of [['GRAPH_TENANT_ID',tenant],['GRAPH_CLIENT_ID',client]])if(value&&!guid.test(value))issues.push({key,code:'invalid_uuid'});
 const extra={};
 if(feature==='mail'){
  extra.sender=need(env,'GRAPH_SENDER',issues);if(extra.sender&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(extra.sender))issues.push({key:'GRAPH_SENDER',code:'invalid_mailbox'});
 }else{
  extra.drive=need(env,'SHAREPOINT_PHOTO_DRIVE_ID',issues);extra.folder=need(env,'SHAREPOINT_PHOTO_FOLDER_ID',issues);
  for(const[key,value]of [['SHAREPOINT_PHOTO_DRIVE_ID',extra.drive],['SHAREPOINT_PHOTO_FOLDER_ID',extra.folder]])if(value&&!/^[\w!.-]{1,240}$/.test(value))issues.push({key,code:'invalid_identifier'});
 }
 return finish('graph-'+feature,issues,{tenant,client,secret,...extra});
}
export function cronConfiguration(env){
 const issues=[],secret=need(env,'CRON_SECRET',issues);if(secret&&secret.length<32)issues.push({key:'CRON_SECRET',code:'minimum_32_characters'});
 return finish('cron',issues,{secret,enabled:env.ASVO_DEMO!=='1'&&(!env.VERCEL||env.VERCEL_ENV==='production')});
}
export function rateConfiguration(env){
 if(demoConfiguration(env).enabled)return {secret:'asvo-local-demo-rate-key-not-for-production'};
 const issues=[],key=env.RATE_LIMIT_SECRET?'RATE_LIMIT_SECRET':'AUTH_SECRET',secret=need(env,key,issues);if(secret&&secret.length<32)issues.push({key,code:'minimum_32_characters'});
 return finish('abuse-control',issues,{secret});
}
export function localDemoHost(host){try{const u=new URL('http://'+host);return isLoopback(u.hostname)&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash;}catch{return false;}}
export function safeDiagnostic(feature,error){
 if(error instanceof ConfigurationError)return {feature:error.feature,issues:error.issues};
 return {feature,code:typeof error?.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:'operation_failed'};
}
export function validTenantSubject(profile,tenant){return profile&&typeof profile==='object'&&profile.tid===tenant&&typeof profile.oid==='string'&&guid.test(profile.oid)?profile.oid:null;}
