import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import parser from 'next/dist/compiled/babel/parser.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const services=['volunteer-profile','outing-unit-conflict','staff-outing-management','outing-series','create-staff-outing','legacy-entry-management','staff-registration-cases','staff-registration-queries','staff-report-cases','staff-communications'].map(name=>'lib/'+name+'.ts');
const actions=readdirSync(resolve(root,'app/actions')).filter(name=>name.endsWith('.ts')).map(name=>'app/actions/'+name);
const fresh=new Set([...actions,...services]),cache=new Map();
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>walk(n,visit));else if(value&&typeof value==='object')walk(value,visit);}
function info(file){
 if(cache.has(file))return cache.get(file);
 const source=readFileSync(resolve(root,file),'utf8'),tree=parser.parse(source,{sourceType:'module',plugins:['typescript',...(file.endsWith('.tsx')?['jsx']:[])]});
 const imports=[];
 for(const node of tree.program.body){
  if(!['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)||!node.source||node.importKind==='type'||node.exportKind==='type')continue;
  if(node.type==='ImportDeclaration'&&node.specifiers.length&&node.specifiers.every(s=>s.importKind==='type'))continue;
  const spec=node.source.value;if(!spec.startsWith('.'))continue;
  const base=resolve(root,dirname(file),spec),path=[base,base+'.ts',base+'.tsx',base+'.mjs',base+'/index.ts'].find(p=>existsSync(p));assert.ok(path,`Unresolved ${file}: ${spec}`);imports.push(relative(root,path));
 }
 const result={tree,imports};cache.set(file,result);return result;
}
for(const file of fresh){
 const {tree,imports}=info(file);
 if(file.startsWith('lib/'))assert.ok(imports.every(p=>!p.startsWith('app/')),`Service imports app: ${file}`);
 else{
  assert.ok(tree.program.directives.some(d=>d.value.value==='use server'),file);
  walk(tree,node=>{if(node.type==='TaggedTemplateExpression')assert.fail(`Move SQL into a case/query service: ${file}`);});
 }
}
// Existing infrastructure is followed, but only a cycle involving this extraction fails the audit.
const visiting=[],done=new Set();
function dfs(file){
 const index=visiting.indexOf(file);if(index>=0){const cycle=visiting.slice(index);assert.ok(!cycle.some(p=>fresh.has(p)),`New dependency cycle: ${cycle.join(' -> ')}`);return;}
 if(done.has(file))return;visiting.push(file);for(const next of info(file).imports)if(/^(app|lib)\//.test(next))dfs(next);visiting.pop();done.add(file);
}
for(const file of fresh)dfs(file);
const compatibility=['app/staff-actions.ts','app/coordinacion/add-registration-actions.ts','app/coordinacion/edit-registration-actions.ts','app/coordinacion/manage-registration-actions.ts','app/coordinacion/registration-detail-actions.ts','app/coordinacion/attendance-actions.ts','app/coordinacion/report-reminder-actions.ts','app/coordinacion/salidas/[id]/resumen/actions.ts','app/resumen-salida/[token]/informe/actions.ts'];
for(const file of compatibility)for(const node of info(file).tree.program.body){
 if(node.type!=='ExportNamedDeclaration'||node.declaration?.type!=='FunctionDeclaration')continue;
 const statements=node.declaration.body.body;assert.equal(statements.length,1,`Adapter must only delegate: ${file}`);
 assert.equal(statements[0].type,'ReturnStatement');assert.equal(statements[0].argument.type,'CallExpression');
}
// The UI uses canonical modules; old paths survive deliberately for published callers and contract tests.
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(n=>n.isDirectory()?files(resolve(path,n.name)):[resolve(path,n.name)]);}
for(const path of files(resolve(root,'app')).filter(p=>p.endsWith('.tsx'))){const file=relative(root,path);assert.ok(!info(file).imports.some(p=>compatibility.includes(p)),`UI still consumes a legacy action: ${file}`);}
console.log(`OK: ${actions.length} módulos de acciones sin SQL inline; ${services.length} servicios sin dependencias hacia app, sin ciclos nuevos; adaptadores solo delegan y no tienen consumidores JSX.`);
