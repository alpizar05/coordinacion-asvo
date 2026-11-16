/** Disposable UI-only harness. No dotenv, DB fixtures, Graph or production routes installed. */
import {mkdtemp,cp,symlink,rm,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {cleanTestEnvironment} from '../test-process.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const temp=await mkdtemp(join(tmpdir(),'asvo-modal-ui-'));
let child,output='';
try{
 for(const name of ['app','lib','public','package.json','tsconfig.json','next.config.ts'])await cp(join(root,name),join(temp,name),{recursive:true});
 await symlink(join(root,'node_modules'),join(temp,'node_modules'),'dir');
 const route=join(temp,'app/modal-fixture');await mkdir(route,{recursive:true});
 await cp(new URL('./fixture-page.jsx',import.meta.url),join(route,'page.jsx'));
 // Keep the real consumers, replacing only their provider-facing action imports
 // in the disposable tree. The real application and actions are never changed.
 await cp(new URL('./link-actions.js',import.meta.url),join(route,'link-actions.js'));
 for(const [file,from,to]of [
  ['app/coordinacion/private-link-form.tsx',"'../actions/communications'","'../modal-fixture/link-actions'"],
  ['app/coordinacion/salidas/[id]/resumen/share-brief.tsx',"'../../../../actions/communications'","'../../../../modal-fixture/link-actions'"],
 ]){const path=join(temp,file),source=await readFile(path,'utf8');if(!source.includes(from))throw Error('El consumidor cambió; revisá el doble de prueba.');await writeFile(path,source.replaceAll(from,to));}
 const env={...cleanTestEnvironment(),ASVO_DEMO:'0',APP_URL:'https://example.test',DATABASE_URL:'postgres://fictitious:fictitious@127.0.0.1:1/no_connection',NEXT_TELEMETRY_DISABLED:'1'};
 child=spawn(process.execPath,['--import',join(root,'tests/action-modal/no-network.mjs'),join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3034'],{cwd:temp,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',buffer=>{const text=buffer.toString();output+=text;process.stdout.write(text);});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill('SIGTERM'));
 console.log('Harness ficticio: http://localhost:3034/modal-fixture?unidad=BRIF&pestana=prueba');
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0||code===null?resolve():reject(Error('Falló servidor UI temporal.')));});
 if(/\[test-(?:network|database)-blocked\]/.test(output))throw Error('El harness intentó un efecto externo.');
}finally{
 await rm(temp,{recursive:true,force:true});
 console.log('Copia UI temporal retirada.');
}
