/** Isolated Next build/HTTP checks: no env files, application DB or providers. */
import {mkdtemp,cp,writeFile,symlink,rm,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';import {createServer} from 'node:net';import assert from 'node:assert/strict';
import {cleanTestEnvironment} from '../tests/test-process.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'asvo-security-build-'));
const env={...cleanTestEnvironment(),NEXT_TELEMETRY_DISABLED:'1',ASVO_DEMO:'0',DATABASE_URL:'postgres://fictitious:fictitious@127.0.0.1:1/no_connection',APP_URL:'https://example.test',AUTH_SECRET:'fictitious-build-key-with-at-least-32-characters',AUTH_TRUST_HOST:'true',AUTH_MICROSOFT_ENTRA_ID_ID:'11111111-1111-4111-8111-111111111111',AUTH_MICROSOFT_ENTRA_ID_SECRET:'fictitious',AUTH_MICROSOFT_ENTRA_ID_ISSUER:'https://login.microsoftonline.com/22222222-2222-4222-8222-222222222222/v2.0',CRON_SECRET:'fictitious-cron-key-with-at-least-32-characters'};
const next=join(root,'node_modules/next/dist/bin/next'),guard=join(root,'tests/db-commands/no-network.mjs');let server,logs='';
function launch(args,cwd=temp){const child=spawn(process.execPath,['--import',guard,next,...args],{cwd,env,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);return {child,output:()=>output};}
async function finish(run){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{run.child.kill('SIGTERM');reject(Error('Next check timed out'));},90000);run.child.on('error',reject);run.child.on('close',code=>{clearTimeout(timer);resolve({code,output:run.output()});});});}
try{
 for(const name of ['app','lib','public','tsconfig.json','next.config.ts','package.json'])await cp(join(root,name),join(temp,name),{recursive:true});
 await symlink(join(root,'node_modules'),join(temp,'node_modules'),'dir');
 const built=await finish(launch(['build','--webpack']));assert.equal(built.code,0,built.output.slice(-5000));
 // Real routes and header resolution; invalid capability causes no DB lookup.
 const port=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const started=launch(['start','--hostname','127.0.0.1','--port',String(port)]);server=started.child;
 const get=path=>fetch(`http://127.0.0.1:${port}${path}`,{redirect:'manual'});
 let ready=false;for(let i=0;i<100;i++){try{await get('/_not-found');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready,'Isolated server ready');
 for(const path of ['/privado/invalid','/resumen-salida/invalid','/api/auth/providers']){
  const response=await get(path);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('x-frame-options'),'DENY');assert.match(response.headers.get('content-security-policy'),/form-action 'self' https:\/\/login.microsoftonline.com/);assert.equal(response.headers.get('strict-transport-security'),'max-age=31536000');assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  if(path==='/api/auth/providers')assert.equal(response.status,200);else{assert.equal(response.status,200);assert.match(await response.text(),/venció|no disponible/);}
 }
 assert.equal((await get('/api/cron/correos')).status,401,'Cron refuses unauthenticated calls');
 server.kill('SIGTERM');await new Promise(r=>server.once('close',r));server=null;logs=started.output();assert.doesNotMatch(logs,/External calls prohibited|ECONNREFUSED/);
 // Actual compiler failure, not merely a marker inventory. No source project is altered.
 await rm(join(temp,'app'),{recursive:true,force:true});await rm(join(temp,'.next'),{recursive:true,force:true});await mkdir(join(temp,'app'));
 await writeFile(join(temp,'app/layout.tsx'),'export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}');
 await writeFile(join(temp,'app/page.tsx'),`'use client';import {sql} from '../lib/db';export default function Page(){return <div>{typeof sql}</div>}`);
 const invalid=await finish(launch(['build','--webpack']));assert.notEqual(invalid.code,0);assert.match(invalid.output,/server-only|Server Component/);
 await mkdir(join(root,'tests/security'),{recursive:true});await writeFile(join(root,'tests/security/build-results.json'),JSON.stringify({checks:['isolated production build without env files','HTTP security and private cache headers','local Auth.js providers route','unauthenticated cron rejected','client importing database rejected by Next compiler'],providers:false,applicationDatabase:false,fixturesRemoved:true},null,2)+'\n');
 console.log('OK: isolated Next production build, real HTTP headers/Auth.js route/cron, server-only compiler rejection. No providers or application DB. Temporary copy removed.');
}finally{if(server){server.kill('SIGTERM');await new Promise(r=>server.once('close',r));}await rm(temp,{recursive:true,force:true});}
