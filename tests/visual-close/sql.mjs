import postgres from 'postgres';import{readFile,writeFile}from'node:fs/promises';import{spawn}from'node:child_process';import{cleanTestEnvironment}from'../test-process.mjs';
const families={'participation-visual':'55529','outing-visual':'55528','registry-visual':'55527'};
if(process.argv[2]==='integration'){
 const a=JSON.parse(await readFile(new URL('../participation-visual/active.json',import.meta.url),'utf8')),u=new URL(a.url);if(u.hostname!=='127.0.0.1'||u.port!=='55529'||u.pathname!=='/postgres')throw Error('Destino no autorizado');
 const check=postgres(u.href,{max:1});try{const[r]=await check`select current_setting('data_directory') as directory,current_setting('server_version') as version`;if(r.directory!==a.temp+'/pg'||r.version!=='18.7')throw Error('Clúster equivocado');}finally{await check.end();}
 const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['scripts/ci/integration.mjs'],{env:{...cleanTestEnvironment(),CI_DATABASE_URL:u.href},stdio:'inherit'});p.once('error',reject);p.once('exit',resolve);});if(code)process.exitCode=code;
}else{
 const all={date:new Date().toISOString(),stage:process.argv[2]};
 for(const[family,port]of Object.entries(families)){
 const a=JSON.parse(await readFile(new URL('../'+family+'/active.json',import.meta.url),'utf8')),u=new URL(a.url);if(u.hostname!=='127.0.0.1'||u.port!==port||u.pathname!=='/postgres')throw Error('Destino no autorizado');const sql=postgres(u.href,{max:1});
 try{const[r]=await sql`select current_setting('data_directory') as directory,current_setting('server_version') as version`;if(r.directory!==a.temp+'/pg'||r.version!=='18.7')throw Error('Clúster equivocado');
 const volunteers=await sql`select id,whatsapp,units from volunteers order by id`;
 const registrations=await sql`select id,outing_id,volunteer_id,status from registrations order by id`,reports=await sql`select outing_id,status,submitted_at,participants from outing_reports order by id`,audit=await sql`select action,count(*)::int as n from audit group by action order by action`,photos=await sql`select outing_id,count(*)::int as n from outing_photos group by outing_id order by outing_id`;
 const[outbox]=await sql`select count(*)::int as n,count(sent_at)::int as accepted from registration_mail_outbox`,[demo]=await sql`select count(*)::int as n from demo_mail`;
 all[family]={version:r.version,volunteers,registrations,reports,audit,photos,outbox,demo};
 }finally{await sql.end();}}
 await writeFile(new URL('./persistence-'+process.argv[2]+'.json',import.meta.url),JSON.stringify(all,null,2));console.log('Snapshots locales saneados guardados; sin tokens ni contenido de comunicaciones.');
}
