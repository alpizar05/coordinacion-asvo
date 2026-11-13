import './node-server-context.mjs';
import {demoConfiguration,databaseConfiguration,applicationConfiguration,authConfiguration,graphConfiguration,cronConfiguration,rateConfiguration,safeDiagnostic} from '../lib/runtime-config.mjs';
const rawArgs=process.argv.slice(2),modeArg=rawArgs.find(arg=>arg.startsWith('--mode=')),mode=modeArg?.slice(7);
if(mode&&!['development','production'].includes(mode))throw Error('Modo inválido.');
const env={...process.env,...(mode?{NODE_ENV:mode}:{})};
const args=rawArgs.filter(arg=>arg!==modeArg),features=args.length?args.map(arg=>arg.replace(/^--feature=/,'')):['database','application','demo','auth','mail','photos','cron','abuse'];
const readers={database:()=>databaseConfiguration(env),application:()=>applicationConfiguration(env),demo:()=>demoConfiguration(env),auth:()=>authConfiguration(env),mail:()=>graphConfiguration(env,'mail'),photos:()=>graphConfiguration(env,'photos'),cron:()=>cronConfiguration(env),abuse:()=>rateConfiguration(env)};
if(args.some(arg=>!arg.startsWith('--feature='))||features.some(name=>!Object.hasOwn(readers,name)))throw Error('Usá --feature=database|application|demo|auth|mail|photos|cron|abuse.');
const results=[];let localDemo=false;
try{localDemo=demoConfiguration(env).enabled;}catch{}
for(const feature of features){
 if(localDemo&&['auth','mail','photos','cron'].includes(feature)){results.push({feature,state:'disabled_in_local_demo'});continue;}
 try{readers[feature]();results.push({feature,state:'valid'});}catch(error){results.push({state:'invalid',...safeDiagnostic(feature,error)});process.exitCode=1;}
}
console.log(JSON.stringify(results,null,2));
