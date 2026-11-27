import {mkdtemp,cp,symlink,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import postgres from 'postgres';
import {prepareDatabase} from '../../lib/database-setup.mjs';
import {cleanTestEnvironment} from '../test-process.mjs';
const root=process.cwd(),temp=await mkdtemp(join(tmpdir(),'asvo-identity-')),pg=join(root,'.local-postgres/runtime-18.7/bin');
const run=(cmd,args)=>{const r=spawnSync(join(pg,cmd),args,{encoding:'utf8'});if(r.status)throw Error(r.stderr);return r.stdout;};
const url='postgres://fixture@127.0.0.1:55530/postgres';let started=false,sql,child;
try{
 run('initdb',['-D',join(temp,'pg'),'-U','fixture','-A','trust','--encoding=UTF8','--no-locale']);
 run('pg_ctl',['-D',join(temp,'pg'),'-l',join(temp,'pg.log'),'-o',`-h 127.0.0.1 -p 55530 -k ${temp}`,'-w','start']);started=true;
 sql=postgres(url,{max:1,onnotice(){}});
 const [server]=await sql`select current_setting('server_version') as version,current_setting('data_directory') as directory`;
 if(server.version!=='18.7'||server.directory!==join(temp,'pg'))throw Error('Destino aislado incorrecto');
 // The protected existing runner creates/drops a separate database for the affected SQL suite.
 const r=spawnSync(process.execPath,['scripts/test-integration.mjs','--only=public-registration'],{cwd:root,env:{...cleanTestEnvironment(),DATABASE_URL:url,ASVO_DEMO:'1',APP_URL:'http://localhost:3047'},encoding:'utf8'});
 console.log(r.stdout);if(r.status)throw Error(r.stderr||'Falló integración');
 await prepareDatabase(sql);
 const request='11111111-1111-4111-8111-000000000701',outing='11111111-1111-4111-8111-000000000702';
 await sql`insert into requests(id,organization,activity)values(${request},'Organización ficticia','Prueba local')`;
 await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${outing},${request},'Salida ficticia','Lugar de prueba','Voluntariado General','2035-01-10','2035-01-12',false,3,'abierta',true)`;
 await sql`insert into volunteers(identification,name,surname,second_surname,email)values('800000701','Persona','Ficticia','Local','identity@example.test')`;
 await sql.end();sql=null;
 for(const name of ['app','lib','public','migrations','package.json','tsconfig.json','next.config.ts'])await cp(join(root,name),join(temp,name),{recursive:true});
 await symlink(join(root,'node_modules'),join(temp,'node_modules'),'dir');
 await writeFile(join(root,'tests/registration-identity/active.json'),JSON.stringify({temp,url,outing}));
 child=spawn(process.execPath,['--import',join(root,'tests/action-modal/no-network.mjs'),join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3047'],{cwd:temp,env:{...cleanTestEnvironment(),ASVO_DEMO:'1',APP_URL:'http://localhost:3047',DATABASE_URL:url,AUTH_SECRET:'fictitious-local-identity-only-00000000000',NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit'});
 for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>child.kill('SIGTERM'));
 await new Promise(resolve=>child.once('exit',resolve));
}finally{
 if(sql)await sql.end();if(started)run('pg_ctl',['-D',join(temp,'pg'),'-m','immediate','-w','stop']);
 await rm(temp,{recursive:true,force:true});await rm(join(root,'tests/registration-identity/active.json'),{force:true});console.log('Fixture retirado');
}
