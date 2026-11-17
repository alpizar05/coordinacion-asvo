/** Offline traceability audit, never a replacement for consumer CUA or persistence. */
import{readFile,writeFile}from'node:fs/promises';import{existsSync}from'node:fs';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const root=new URL('../../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const matrix=await read('docs/matriz-visual-consumidores.json');const cache=new Map();
async function dataset(path){if(!cache.has(path))cache.set(path,await read(path));return cache.get(path);}
async function resolveEvidence(ref){
 let file,caseName,prefix=false;
 if(typeof ref==='object'){file=ref.archivo;caseName=ref.caso;}else{const split=ref.split('#');file=split[0];caseName=split[1];prefix=true;}
 if(!file||!existsSync(new URL(file,root)))return {file,missing:true};
 if(typeof ref==='object'&&ref.celda){const d=await dataset(file);const item=d.decisions?.find(x=>x.key===ref.celda);return {file,cell:ref.celda,matches:item?.candidates||[],missing:!item||!item.candidates?.length};}
 if(!caseName)return {file,exists:true};
 const data=await dataset(file);const cases=data.cases||data.observations||[];
 const patterns=caseName.split(' / ');const matches=cases.filter(x=>patterns.some(p=>prefix?x.name.startsWith(p):x.name===p));
 return {file,requested:caseName,prefix,matches:matches.map(x=>x.name),missing:!matches.length};
}
const audit=[],states={},counts={};
for(const row of matrix.recorridos)for(const view of row.vistas)for(const[criterion,cell]of Object.entries(view.celdas)){
 const key=row.id+':'+view.viewport+':'+criterion;if(states[key])throw Error('Duplicate cell');states[key]=cell.estado;counts[cell.estado]=(counts[cell.estado]||0)+1;
 const evidence=[];for(const ref of [...(cell.evidencia||[]),...(cell.evidencia_consumidor?[cell.evidencia_consumidor]:[])])evidence.push(await resolveEvidence(ref));
 audit.push({key,route:row.ruta,consumer:row.consumidor,state:cell.estado,claim:cell.afirmacion||cell.motivo,method:cell.metodo,date:cell.fecha,revision:cell.revision,evidence,missingMetadata:cell.estado==='verificada'&&(!cell.fecha||!cell.revision||!cell.metodo||!evidence.length),scopeReview:cell.estado==='verificada'?'Revisión manual por criterio requerida; existencia de archivo no aprueba comportamiento.':'Conservar pendiente/bloqueada/N; no aprobación implícita.'});
}
const sources={};for(const key of Object.keys(matrix).filter(k=>k.startsWith('fuentes'))){sources[key]=[];for(const[file,hash]of Object.entries(matrix[key])){const url=new URL(file,root);if(!existsSync(url)){sources[key].push({file,missing:true});continue;}const actual=createHash('sha256').update(await readFile(url)).digest('hex');if(actual!==hash)sources[key].push({file,expected:hash,actual});}}
const report={date:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),counts,cells:audit,sources,missingEvidence:audit.filter(x=>x.state==='verificada'&&x.evidence.some(e=>e.missing)).map(x=>x.key),missingMetadata:audit.filter(x=>x.missingMetadata).map(x=>x.key)};
await writeFile(new URL('./audit.json',import.meta.url),JSON.stringify(report));console.log(JSON.stringify({counts,missingEvidence:report.missingEvidence,missingMetadata:report.missingMetadata,sourceDifferences:sources},null,2));
