import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import parser from 'next/dist/compiled/babel/parser.js';
const root=fileURLToPath(new URL('../',import.meta.url)),cache=new Map();
const guarded=['lib/db.ts','lib/auth.ts','lib/server-config.mjs','lib/graph-mail.mjs','lib/outing-photos.ts','lib/abuse-limits.ts','lib/private-links.ts','lib/registry-import.ts'];
function parse(file){
 if(cache.has(file))return cache.get(file);
 const source=readFileSync(resolve(root,file),'utf8'),tree=parser.parse(source,{sourceType:'module',plugins:['typescript',...(file.endsWith('.tsx')?['jsx']:[])]});
 const result={server:tree.program.directives.some(d=>d.value.value==='use server'),client:tree.program.directives.some(d=>d.value.value==='use client'),imports:[]};
 for(const n of tree.program.body){
  if(!['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type)||!n.source||n.importKind==='type'||n.exportKind==='type')continue;
  if(n.type==='ImportDeclaration'&&n.specifiers.length&&n.specifiers.every(s=>s.importKind==='type'))continue;
  const spec=n.source.value;
  if(spec==='server-only')result.guarded=true;
  if(spec.startsWith('.')){const base=resolve(root,dirname(file),spec),path=[base,base+'.ts',base+'.tsx',base+'.mjs',base+'/index.ts'].find(p=>existsSync(p));if(path&&/\.(ts|tsx|mjs)$/.test(path))result.imports.push(relative(root,path));}
 }
 cache.set(file,result);return result;
}
for(const file of guarded)assert.ok(parse(file).guarded,`Missing server-only marker: ${file}`);
function walkFiles(dir){return readdirSync(resolve(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walkFiles(dir+'/'+e.name):/\.(ts|tsx|mjs)$/.test(e.name)?[dir+'/'+e.name]:[]);}
function check(file,seen=new Set()){
 if(seen.has(file))return;seen.add(file);const item=parse(file);if(item.server)return;
 assert.ok(!item.guarded,`Client dependency reached server module: ${file}`);
 assert.ok(!file.startsWith('scripts/'),`Application depends on Node bridge/maintenance script: ${file}`);
 for(const dep of item.imports)check(dep,seen);
}
const files=walkFiles('app');for(const file of files)if(parse(file).client)check(file);
assert.ok(!readFileSync(resolve(root,'lib/registration-receipt.ts'),'utf8').includes('delete from registration_receipts'));
console.log(`OK: ${guarded.length} server-only boundaries; client imports respect server-action boundaries; no receipt retention deletion.`);
