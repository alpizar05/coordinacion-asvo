/** Disposable real routes/auth/policies/SQL; test-only delayed responses, no external providers. */
import {mkdtemp,cp,symlink,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawn,spawnSync} from 'node:child_process';import postgres from 'postgres';
import {cleanTestEnvironment} from '../test-process.mjs';import {prepareDatabase} from '../../lib/database-setup.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));const temp=await mkdtemp(join(tmpdir(),'asvo-registry-visual-'));const pg=join(root,'.local-postgres/runtime-18.7/bin');let child,started=false,sql;
const run=(name,args)=>{const r=spawnSync(join(pg,name),args,{encoding:'utf8'});if(r.status)throw Error(r.stderr||r.stdout);return r.stdout;};
const port='55527',url=`postgres://fixture@127.0.0.1:${port}/postgres`;
try{
 console.log('Destino reservado: 127.0.0.1:55527, clúster nuevo en '+temp);run('initdb',['-D',join(temp,'pg'),'-U','fixture','-A','trust','--encoding=UTF8','--no-locale']);run('pg_ctl',['-D',join(temp,'pg'),'-l',join(temp,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${temp}`,'-w','start']);started=true;
 sql=postgres(url,{max:1,onnotice(){}});const [info]=await sql`select current_database() as db,current_setting('data_directory') as path,version() as version`;if(info.db!=='postgres'||info.path!==join(temp,'pg'))throw Error('Destino no autorizado');console.log(info.version);await prepareDatabase(sql);
 const person='11111111-1111-4111-8111-000000000101',outing='11111111-1111-4111-8111-000000000102',request='11111111-1111-4111-8111-000000000103',lead='11111111-1111-4111-8111-000000000104',entry='11111111-1111-4111-8111-000000000105',leadEntry='11111111-1111-4111-8111-000000000106';
 await sql`insert into grants(subject,role,unit)values('local-admin','admin',''),('local-coordination','general','') on conflict do nothing`;
 await sql`insert into volunteers(id,identification,name,surname,email,units)values(${person},'800000101','Persona','Ficticia','persona@example.test',array['Voluntariado General']),(${lead},'800000104','Responsable','Ficticio','responsable@example.test',array['Voluntariado General'])`;
 await sql`insert into requests(id,organization,activity)values(${request},'Organización Ficticia','Actividad local')`;
 await sql`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)values(${outing},${request},'Salida Ficticia','Local','Voluntariado General','2035-01-10','2035-01-12',true,3,'completada',false)`;
 for(const[id,v]of[[entry,person],[leadEntry,lead]])await sql`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)values(${id},${outing},${v},${v},'2035-01-10','2035-01-12','confirmada','{}'::jsonb)`;
 for(const[l,name,attended]of[[entry,'Persona',true],[leadEntry,'Responsable',false]])await sql`insert into outing_reports(outing_id,lead_registration_id,lead_name,lead_email,labour,location,activity,starts,ends,actions,host,observations,participants,status)values(${outing},${l},${name},'demo@example.test','Mantenimiento','Local','Prueba','2035-01-10','2035-01-12','Prueba','Ficticio','',${sql.json([{id:entry,name:'Persona Ficticia',attended}])},'finalizado')`;
 await sql.end();sql=null;
 for(const name of ['app','lib','public','migrations','package.json','tsconfig.json','next.config.ts'])await cp(join(root,name),join(temp,name),{recursive:true});await symlink(join(root,'node_modules'),join(temp,'node_modules'),'dir');
 // Auth, authorization, pages and queries stay intact. Only action response transport is decorated.
 for(const family of ['volunteers','administration','reports'])await cp(join(temp,`app/actions/${family}.ts`),join(temp,`app/actions/${family}-real.ts`));
 await cp(new URL('./faults.ts.txt',import.meta.url),join(temp,'lib/visual-faults.ts'));
 await writeFile(join(temp,'app/actions/volunteers.ts'),`'use server';import * as real from './volunteers-real';import {decorate} from '../../lib/visual-faults';
export async function editProfile(id:string,f:FormData){return decorate('profile',f,()=>real.editProfile(id,f));}
export async function updateVolunteerUnits(id:string,f:FormData){return decorate('units',f,()=>real.updateVolunteerUnits(id,f));}
export async function verifyPolicy(f:FormData){return decorate('policy',f,()=>real.verifyPolicy(f));}
export async function recordVolunteerIncident(id:string,f:FormData){return decorate('incident',f,()=>real.recordVolunteerIncident(id,f));}
export async function importPreview(csv:string){return real.importPreview(csv);}
export async function previewPolicies(csv:string){return real.previewPolicies(csv);}
export async function applyImportRows(f:FormData){return decorate('import',f,()=>real.applyImportRows(f));}
export async function applyPolicyRows(f:FormData){return decorate('policyImport',f,()=>real.applyPolicyRows(f));}
`);
 await writeFile(join(temp,'app/actions/administration.ts'),`'use server';import {grant as real} from './administration-real';import {decorate} from '../../lib/visual-faults';export async function grant(f:FormData){return decorate('grant',f,()=>real(f));}`);
 // Preserve every other report action and import; decorate only reconciliation.
 let reports=await readFile(join(temp,'app/actions/reports-real.ts'),'utf8');reports=reports.replace('export async function reconcileAttendance(','async function reconcileAttendanceReal(');reports+=`\nexport async function reconcileAttendance(outingId:string,volunteerId:string,form:FormData){return (await import('../../lib/visual-faults')).decorate('attendance',form,()=>reconcileAttendanceReal(outingId,volunteerId,form));}\n`;reports=reports.replace('export async function submitReport(','async function submitReportReal(');reports+=`\nexport async function submitReport(token:string,previous:FormResult,form:FormData):Promise<ReportSubmissionResult>{if(token!=="fictitious-component-only")return submitReportReal(token,previous,form);await new Promise(r=>setTimeout(r,1800));return {error:"Fallo de informe simulado: sin persistencia."};}\n`;await writeFile(join(temp,'app/actions/reports.ts'),reports);
 const regression=join(temp,'app/coordinacion/auditoria-regresion');await mkdir(regression,{recursive:true});await cp(new URL('./report-regression.jsx',import.meta.url),join(regression,'page.jsx'));
 const csvFolder=join(temp,'csv');await mkdir(csvFolder);for(const [name,body]of Object.entries({invalid:'nombre\nFicticia\n',volunteers:'identificacion,nombre,primer_apellido,correo\n800000301,Persona nueva,Ficticia,nueva@example.test\nINVALIDA,,Ficticia,mal\n',policies:'identificacion,tipo,numero\n800000101,DEMO,VISUAL-IMPORT\n800099999,DEMO,DESCONOCIDA\n'}))await writeFile(join(csvFolder,name+'.csv'),body);console.log('CSV ficticios: '+csvFolder);

 const start=join(temp,'app/audit/start');await mkdir(start,{recursive:true});await writeFile(join(start,'route.ts'),`import {NextResponse} from 'next/server';export async function GET(r:Request){const q=new URL(r.url).searchParams;const target=q.get('target')==='admin'?'/coordinacion/administracion':q.get('target')==='attendance'?'/coordinacion/salidas/${outing}':'/coordinacion/registro/${person}';const out=NextResponse.redirect(new URL(target+'?seccion='+ (q.get('section')||'information')+'&audit=registry',r.url));out.cookies.set('asvo-demo',q.get('role')==='general'?'general':'admin');out.cookies.set('audit-run',crypto.randomUUID());return out;}`);
 console.log('FIXTURE '+JSON.stringify({temp,url,person,outing,pgVersion:info.version}));await writeFile(join(root,'tests/registry-visual/active.json'),JSON.stringify({temp,url,person,outing,pid:process.pid}));
 child=spawn(process.execPath,['--import',join(root,'tests/action-modal/no-network.mjs'),join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3044'],{cwd:temp,env:{...cleanTestEnvironment(),ASVO_DEMO:'1',APP_URL:'http://localhost:3044',DATABASE_URL:url,AUTH_SECRET:'fictitious-local-visual-only-000000000000',NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit'});
 for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>child.kill('SIGTERM'));await new Promise(resolve=>child.once('close',resolve));
}finally{if(sql)await sql.end();if(started)run('pg_ctl',['-D',join(temp,'pg'),'-m','immediate','-w','stop']);await rm(temp,{recursive:true,force:true});await rm(join(root,'tests/registry-visual/active.json'),{force:true});console.log('Clúster y aplicación ficticios retirados');}
