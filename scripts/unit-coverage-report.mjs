import {readFile,writeFile} from 'node:fs/promises';
import {coverageModules} from '../tests/unit/modules.mjs';
export async function summarizeCoverage(){
 const text=await readFile(new URL('../coverage/unit.lcov',import.meta.url),'utf8');
 const fraction=(hit,found)=>({hit,found,percent:found?Number((100*hit/found).toFixed(2)):100});
 const modules=text.split('end_of_record').filter(block=>block.includes('SF:')).map(block=>{
  const field=name=>block.match(new RegExp('^'+name+':(.*)$','m'))?.[1];
  return {path:field('SF'),lines:fraction(Number(field('LH')),Number(field('LF'))),
   branches:fraction(Number(field('BRH')),Number(field('BRF'))),functions:fraction(Number(field('FNH')),Number(field('FNF'))),
   uncoveredLines:[...block.matchAll(/^DA:(\d+),0$/gm)].map(match=>Number(match[1])),
   uncoveredBranches:[...block.matchAll(/^BRDA:(\d+),([^,]+),([^,]+),(?:0|-)$/gm)].map(match=>({line:Number(match[1]),block:match[2],branch:match[3]}))};
 }).sort((a,b)=>a.path.localeCompare(b.path));
 if(JSON.stringify(modules.map(m=>m.path).sort())!==JSON.stringify([...coverageModules].sort()))throw Error('El informe no contiene exactamente los módulos declarados; revisá imports y denominador.');
 const totals=Object.fromEntries(['lines','branches','functions'].map(key=>[key,fraction(modules.reduce((n,m)=>n+m[key].hit,0),modules.reduce((n,m)=>n+m[key].found,0))]));
 const report={generatedAt:new Date().toISOString(),runtime:process.version,engine:'node:test / V8',
  scope:'Explicit pure-module subset only; not platform coverage. See tests/unit/modules.mjs.',totals,modules};
 await writeFile(new URL('../coverage/unit-summary.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(`Cobertura de ${modules.length} módulos declarados: líneas ${totals.lines.percent} %, ramas ${totals.branches.percent} %, funciones ${totals.functions.percent} %. No es cobertura global.`);
 return report;
}
