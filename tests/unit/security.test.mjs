import test from 'node:test';import assert from 'node:assert/strict';
import {ConfigurationError,databaseConfiguration,applicationConfiguration,demoConfiguration,authConfiguration,graphConfiguration,cronConfiguration,rateConfiguration,localDemoHost,safeDiagnostic,validTenantSubject} from '../../lib/runtime-config.mjs';
import {requireLocalDemo} from '../../lib/local-demo.mjs';
import {securityHeaders,privateHeaders,privateRequestLogPatterns} from '../../lib/security-headers.mjs';
import {abuseLimits,normalizedAddress,trustedClientAddress} from '../../lib/security-rules.mjs';
const uuid='11111111-1111-4111-8111-111111111111',secret='fictitious-SECRET-never-log-this-123456789';
const local={NODE_ENV:'development',ASVO_DEMO:'1',DATABASE_URL:'postgres://localhost/asvo_test',APP_URL:'http://localhost:3031'};
const production={NODE_ENV:'production',ASVO_DEMO:'0',DATABASE_URL:'postgres://fake:fake@db.example.test/asvo?sslmode=require',APP_URL:'https://example.test',AUTH_SECRET:secret,AUTH_MICROSOFT_ENTRA_ID_ID:uuid,AUTH_MICROSOFT_ENTRA_ID_SECRET:secret,AUTH_MICROSOFT_ENTRA_ID_ISSUER:`https://login.microsoftonline.com/${uuid}/v2.0`,GRAPH_TENANT_ID:uuid,GRAPH_CLIENT_ID:uuid,GRAPH_CLIENT_SECRET:secret,GRAPH_SENDER:'sender@example.test',CRON_SECRET:secret,SHAREPOINT_PHOTO_DRIVE_ID:'b!fake-drive',SHAREPOINT_PHOTO_FOLDER_ID:'fake-folder'};
const invalid=(reader,env)=>assert.throws(()=>reader(env),ConfigurationError);
test('database/app configuration rejects unsafe URLs and TLS downgrade without exposing values',()=>{
 assert.equal(databaseConfiguration(local).url,'postgres://localhost/asvo_test');assert.equal(applicationConfiguration(production).origin,'https://example.test');databaseConfiguration(production);
 for(const url of ['', 'https://db.example.test/asvo','postgres://host/','postgres://fake:fake@db.example.test/asvo?sslmode=disable','postgres://localhost/asvo?host=evil.example.test'])invalid(databaseConfiguration,{...production,DATABASE_URL:url});
 for(const url of ['http://example.test','https://user:password@example.test','https://example.test/path','https://example.test/?token=private','https://example.test/#private','invalid'])invalid(applicationConfiguration,{...production,APP_URL:url});
 invalid(databaseConfiguration,{...production,NEXT_PUBLIC_GRAPH_CLIENT_SECRET:secret});
 try{databaseConfiguration({...production,DATABASE_URL:`postgres://fake:${secret}@db.example.test/asvo?sslmode=disable`});}catch(error){assert.doesNotMatch(JSON.stringify(safeDiagnostic('db',error))+error.stack,new RegExp(secret));}
});
test('duplicate URL options cannot override the validated TLS mode',()=>{invalid(databaseConfiguration,{...production,DATABASE_URL:production.DATABASE_URL+'&sslmode=disable'});});
test('demo only authorizes development with local DB/origin and never Vercel or preview',()=>{
 assert.equal(demoConfiguration(local).enabled,true);assert.equal(demoConfiguration(production).enabled,false);
 for(const changes of [{NODE_ENV:'production'},{NODE_ENV:'test'},{VERCEL:'1'},{VERCEL_ENV:'preview'},{DATABASE_URL:production.DATABASE_URL},{APP_URL:'https://example.test'},{ASVO_DEMO:'true'}])invalid(demoConfiguration,{...local,...changes});
 for(const host of ['localhost:3031','127.0.0.1:3031','[::1]:3000'])assert.equal(localDemoHost(host),true);
 for(const host of ['example.test','localhost.evil.test','user@localhost','localhost/path','localhost?x=y',''])assert.equal(localDemoHost(host),false);
});
test('auth, Graph and cron validate per feature; secrets are never diagnostics',()=>{
 assert.equal(authConfiguration(production).tenant,uuid);graphConfiguration(production,'mail');graphConfiguration(production,'photos');assert.equal(cronConfiguration(production).enabled,true);
 invalid(authConfiguration,{...production,AUTH_SECRET:'short'});invalid(authConfiguration,{...production,AUTH_MICROSOFT_ENTRA_ID_ISSUER:'https://login.microsoftonline.com/common/v2.0'});invalid(authConfiguration,{...production,AUTH_MICROSOFT_ENTRA_ID_ID:'bad'});
 invalid(graphConfiguration,{}); // Unknown/missing feature fails closed too.
 for(const feature of ['mail','photos']){
  for(const key of ['GRAPH_TENANT_ID','GRAPH_CLIENT_ID','GRAPH_CLIENT_SECRET',...(feature==='mail'?['GRAPH_SENDER']:['SHAREPOINT_PHOTO_DRIVE_ID','SHAREPOINT_PHOTO_FOLDER_ID'])])assert.throws(()=>graphConfiguration({...production,[key]:''},feature),ConfigurationError);
 }
 assert.throws(()=>graphConfiguration({...production,GRAPH_SENDER:'bad'},'mail'));assert.throws(()=>graphConfiguration({...production,SHAREPOINT_PHOTO_FOLDER_ID:'../bad'},'photos'));
 invalid(cronConfiguration,{...production,CRON_SECRET:'short'});assert.equal(cronConfiguration({...production,VERCEL:'1',VERCEL_ENV:'preview'}).enabled,false);
 const d=safeDiagnostic('sql',{message:secret,detail:secret,code:'23505'});assert.deepEqual(d,{feature:'sql',code:'23505'});assert.equal(safeDiagnostic('sql',{code:secret}).code,'operation_failed');
 assert.equal(rateConfiguration(local).secret.includes('demo'),true);assert.equal(rateConfiguration(production).secret,secret);assert.equal(rateConfiguration({...production,RATE_LIMIT_SECRET:secret+'extra'}).secret,secret+'extra');invalid(rateConfiguration,{...production,AUTH_SECRET:''});
});
test('tenant subject validation never treats malformed or cross-tenant profiles as staff',()=>{
 assert.equal(validTenantSubject({tid:uuid,oid:uuid},uuid),uuid);for(const p of [null,{},[],{tid:'other',oid:uuid},{tid:uuid,oid:secret},{tid:uuid,oid:{}}])assert.equal(validTenantSubject(p,uuid),null);
});
test('shared-network limits trust only normalized Vercel ingress; capabilities have separate budgets',()=>{
 assert.equal(trustedClientAddress({VERCEL:'1'},'203.0.113.4, 10.0.0.1'),'203.0.113.4');assert.equal(trustedClientAddress({},'203.0.113.4'),null);
 assert.equal(normalizedAddress('2001:db8::1'),'2001:db8::1');assert.equal(normalizedAddress('127.0.0.1'),'127.0.0.1');
 for(const ip of ['999.0.0.1','001.2.3.4','http://example.test','::bad::bad','example.test','a'.repeat(100),null])assert.equal(normalizedAddress(ip),null);
 assert.equal(trustedClientAddress({VERCEL:'1'},'x'.repeat(1025)),null);assert.equal(abuseLimits.registration,8);assert.ok(abuseLimits.network>abuseLimits.privateMutation);
});
test('security headers leave hydration/OIDC compatible and never log private URL routes',()=>{
 const dev=Object.fromEntries(securityHeaders(local).map(h=>[h.key,h.value])),prod=Object.fromEntries(securityHeaders(production).map(h=>[h.key,h.value]));
 assert.equal(dev['X-Frame-Options'],'DENY');assert.equal(dev['X-Content-Type-Options'],'nosniff');assert.equal(dev['Referrer-Policy'],'no-referrer');assert.ok(dev['Permissions-Policy'].includes('camera=()'));
 assert.match(dev['Content-Security-Policy'],/form-action 'self' https:\/\/login.microsoftonline.com/);assert.doesNotMatch(dev['Content-Security-Policy'],/script-src|style-src|unsafe-eval/);
 assert.equal(dev['Strict-Transport-Security'],undefined);assert.equal(prod['Strict-Transport-Security'],'max-age=31536000');assert.ok(privateHeaders.some(h=>h.value==='private, no-store'));
 for(const url of ['/privado/fake-secret','/resumen-salida/fake-secret/informe','/convocatorias/id?invitacion=secret','/api/fotos/id?invitacion=secret'])assert.ok(privateRequestLogPatterns.some(pattern=>pattern.test(url)));
});

test('demo maintenance commands also reject deployment/production environments',()=>{for(const value of [{VERCEL:'1'},{VERCEL_ENV:'preview'},{NODE_ENV:'production'}])assert.throws(()=>requireLocalDemo({...local,...value}),/ASVO_DEMO=1/);assert.ok(requireLocalDemo(local));});
