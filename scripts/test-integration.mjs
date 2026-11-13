import postgres from 'postgres';
import {randomUUID} from 'node:crypto';
import {requireLocalDemo} from '../lib/local-demo.mjs';
import {prepareDatabase} from '../lib/database-setup.mjs';
import {integrationScripts,contracts} from '../tests/integration/manifest.mjs';
import {cleanTestEnvironment,runScript} from '../tests/test-process.mjs';

// Parent URL is used ONLY to create/drop dedicated local test databases; no application fixtures there.
const source=requireLocalDemo();
const args=process.argv.slice(2),skipContracts=args.includes('--skip-contracts');
const choices=args.filter(arg=>arg.startsWith('--only='));
const selected=choices[0]?.slice(7)??null;
if(new Set(args).size!==args.length||choices.length>1||args.some(arg=>arg!=='--skip-contracts'&&!arg.startsWith('--only='))||(selected!==null&&!integrationScripts.some(item=>item.name===selected)))throw Error('Grupo u opción de integración desconocidos.');
const jobs=selected?integrationScripts.filter(item=>item.name===selected):integrationScripts;
const admin=postgres(source.href,{max:1,onnotice(){}}),controller=new AbortController();
const interrupt=()=>controller.abort();process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
try{
 if(!selected&&!skipContracts)for(const file of contracts)await runScript(file,cleanTestEnvironment(),{signal:controller.signal});
 for(const job of jobs){
  const name='asvo_integration_test_'+randomUUID().replaceAll('-','');
  if(!/^asvo_integration_test_[a-f0-9]+$/.test(name))throw Error('Nombre de base temporal inválido.');
  const target=new URL(source);target.pathname='/'+name;
  let created=false,sql;
  try{
   await admin.unsafe(`create database "${name}"`);created=true;
   sql=postgres(target.href,{max:1,onnotice(){}});
   if((await sql`select current_database() as name`)[0].name!==name)throw Error('Destino inesperado; prueba detenida.');
   if(!job.ownsDatabase)await prepareDatabase(sql);
   await sql.end();sql=null;
   const env={...cleanTestEnvironment(),DATABASE_URL:target.href,ASVO_DEMO:'1',NODE_ENV:'development',APP_URL:'http://localhost:3031',GRAPH_SENDER:'coordination@example.test',GRAPH_TENANT_ID:'11111111-1111-4111-8111-111111111111',GRAPH_CLIENT_ID:'22222222-2222-4222-8222-222222222222',GRAPH_CLIENT_SECRET:'fictitious-provider-test-only'};
   console.log(`Integración: ${job.name} (base local desechable).`);
   await runScript(job.file,env,{signal:controller.signal});
  }finally{
   if(sql)await sql.end();
   if(created)await admin.unsafe(`drop database "${name}" with (force)`);
  }
 }
 console.log(`OK: ${jobs.length} grupos de integración; bases temporales retiradas, sin correos ni cargas reales.`);
}finally{await admin.end();process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);}
