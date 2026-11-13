import { spawn } from 'node:child_process';
export function cleanTestEnvironment() {
 const env={TZ:'UTC',LANG:'C.UTF-8'};
 for(const name of ['PATH','SystemRoot','WINDIR','TMP','TEMP','TMPDIR'])if(process.env[name])env[name]=process.env[name];
 return env;
}
export async function runScript(file,env,{signal}={}) {
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--import','./tests/db-commands/no-network.mjs',file],{
   cwd:new URL('../',import.meta.url),env,stdio:'inherit',signal,
  });
  const timeout=setTimeout(()=>child.kill('SIGTERM'),120000);
  let failure;
  child.on('error',error=>{failure=error;if(!child.pid){clearTimeout(timeout);reject(error);}});
  child.on('close',code=>{clearTimeout(timeout);failure?reject(failure):code===0?resolve():reject(new Error(`${file}: terminó con código ${code}.`));});
 });
}
