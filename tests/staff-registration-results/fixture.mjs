/** Real add/edit consumers in a temporary UI tree; no credentials, DB or providers. */
import {mkdtemp,cp,symlink,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';
import {cleanTestEnvironment} from '../test-process.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'asvo-staff-results-ui-'));let child,output='';
try{
 for(const name of ['app','lib','public','package.json','tsconfig.json','next.config.ts'])await cp(join(root,name),join(temp,name),{recursive:true});
 await symlink(join(root,'node_modules'),join(temp,'node_modules'),'dir');const route=join(temp,'app/staff-registration-fixture');await mkdir(route,{recursive:true});
 for(const[name,target]of[['page.jsx','page.jsx'],['actions.js','actions.js']])await cp(new URL(name,import.meta.url),join(route,target));
 for(const file of ['app/coordinacion/add-registration.tsx','app/coordinacion/edit-registration.tsx']){
  const path=join(temp,file),source=await readFile(path,'utf8'),from="'../actions/registrations'";
  if(!source.includes(from))throw Error('Revisá la frontera del consumidor antes de sustituir acciones.');
  await writeFile(path,source.replaceAll(from,"'../staff-registration-fixture/actions'"));
 }
 // Audit variant uses the real navigation provider/restorer but no auth/DB layout.
 const review=join(temp,'app/coordinacion/salidas/22222222-2222-4222-8222-222222222222');await mkdir(review,{recursive:true});
 await cp(new URL('review-page.jsx',import.meta.url),join(review,'page.jsx'));
 await writeFile(join(temp,'app/coordinacion/layout.tsx'),`'use client';import {NavigationContextProvider} from './navigation-context';import {ConfirmationProvider} from '../status-ribbon';import './coordination.css';export default function Layout({children}:{children:React.ReactNode}){return <NavigationContextProvider subject="fictitious-staff-results-review"><ConfirmationProvider><div className="coordination-content">{children}</div></ConfirmationProvider></NavigationContextProvider>}`);
 child=spawn(process.execPath,['--import',join(root,'tests/action-modal/no-network.mjs'),join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3035'],{cwd:temp,env:{...cleanTestEnvironment(),ASVO_DEMO:'0',APP_URL:'https://example.test',DATABASE_URL:'postgres://fictitious:fictitious@127.0.0.1:1/no_connection',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b;process.stdout.write(b);});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill('SIGTERM'));
 console.log('Harness local: http://localhost:3035/staff-registration-fixture?estado=revisi%C3%B3n&pestana=inscripciones');
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0||code===null?resolve():reject(Error('Falló harness local.')));});
 if(/\[test-(?:network|database)-blocked\]/.test(output))throw Error('El harness intentó un efecto externo.');
}finally{await rm(temp,{recursive:true,force:true});console.log('Copia UI ficticia retirada.');}
