import {readFileSync,readdirSync} from 'node:fs';import {join,relative} from 'node:path';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {authorizationMatrix} from '../lib/authorization.ts';import {entrypoints} from '../tests/authorization/entrypoints.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(join(path,item.name)):[join(path,item.name)]);}
const capabilities=new Set(['session.login','session.logout','public.registration','private.registration','private.report','photos.capability-read','automation.cron','provider.auth']);
const surface={};
for(const file of files(join(root,'app')).filter(path=>path.endsWith('.ts'))){
 const text=readFileSync(file,'utf8'),path=relative(root,file);
 if(!/^['"]use server['"]/m.test(text)&&!path.endsWith('/route.ts'))continue;
 const exports=[...text.matchAll(/export async function (\w+)\(/g)].map(match=>match[1]);
 if(path.endsWith('/route.ts'))for(const match of text.matchAll(/export const \{([^}]+)\}/g))exports.push(...match[1].split(',').map(name=>name.trim()));
 surface[path]=exports.sort();
}
assert.deepEqual(Object.keys(surface).sort(),Object.keys(entrypoints).sort(),'Classify every action/handler file before adding an entry point');
let count=0;
for(const [file,operations]of Object.entries(entrypoints)){
 assert.deepEqual(surface[file],Object.keys(operations).sort(),`Unclassified public operation: ${file}`);
 for(const operation of Object.values(operations))assert.ok(Object.hasOwn(authorizationMatrix,operation)||capabilities.has(operation),`Unknown policy: ${operation}`);
 count+=Object.keys(operations).length;
}
console.log(`OK: inventario de ${count} acciones/handlers en ${Object.keys(surface).length} archivos; cada operación tiene política o capacidad declarada. La inspección estática no reemplaza pruebas de acceso.`);
