/** Trace each verified cell to observations of that consumer. Never fills pending cells. */
import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
const root=new URL('../../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const m=await read('tests/visual-close/matrix-before.json');const datasets={};
for(const family of['registry-visual','outing-visual','participation-visual']){const d=await read('tests/'+family+'/results.json');datasets[family]=await Promise.all(d.cases.map(async c=>c.dom?c:{...c,...await read('tests/'+family+'/'+c.file)}));}
const plan={M06:['outing-visual',['series-actions']],M07:['outing-visual',['series-actions','series']],M15:['registry-visual',['attendance']],M19:['outing-visual',['feature']],M20:['outing-visual',['new']],M21:['outing-visual',['block','clone']],M22:['outing-visual',['edit','individual','photo-parent','parent-file']],M23:['outing-visual',['block']],M24:['outing-visual',['new-photo','gallery','prepared-photo','photo-edit']],M25:['outing-visual',['upload','photo-edit','edit-graph','parent-file']],M27:['outing-visual',['common']],M28:['outing-visual',['series-feature','series-clone']],M29:['outing-visual',['manual']],M30:['outing-visual',['manual-persisted']],M32:['registry-visual',['profile']],M33:['registry-visual',['units']],M34:['registry-visual',['policy']],M35:['registry-visual',['incident']],M37:['registry-visual',['grant']],M38:['registry-visual',['import']],M39:['registry-visual',['policy-import']],M10:['participation-visual',['assign','unassign','confirm','wait','reject','cancel','recover','reconfirm']],M11:['participation-visual',['add']],M12:['participation-visual',['edit']],M16:['participation-visual',['invitation']],M17:['participation-visual',['split']],M41:['participation-visual',['brief','revoke']],M43:['participation-visual',['draft','final','report','70-brief']]};
const decisions=[],hashes={};
for(const row of m.recorridos)for(const v of row.vistas)for(const[criterion,cell]of Object.entries(v.celdas)){
 if(cell.estado!=='verificada')continue;
 const key=row.id+':'+v.viewport+':'+criterion;
 const[family,prefixes]=plan[row.id]||[];
 const stem=v.viewport==='desktop'?'desktop':'mobile';
 let candidates=family?datasets[family].filter(o=>prefixes.some(p=>o.name.startsWith(stem+'-'+p))):[];
 // Same prefix can describe creation and editing; constrain by actual route.
 if(row.id==='M21')candidates=candidates.filter(o=>o.dom.url.includes('/salidas/nueva'));
 if(row.id==='M23')candidates=candidates.filter(o=>o.dom.url.includes('editar=1'));
 if(row.id==='M24')candidates=candidates.filter(o=>o.dom.url.includes('/salidas/nueva'));
 if(row.id==='M25')candidates=candidates.filter(o=>o.dom.url.includes('editar=1'));
 // Explicitly excluded transient/misnamed observations from the stage reports.
 candidates=candidates.filter(o=>!['desktop-split-false-close-reproduced','mobile-series-feature-cleared','mobile-series-feature-origin-blocked','desktop-profile-discard-request','desktop-import-conflict-repeat','desktop-final-response-inspect','mobile-reconfirm-malformed','mobile-reconfirm-mixed','mobile-reconfirm-rejection'].includes(o.name));
 const evidence=candidates.map(o=>({archivo:'tests/'+family+'/results.json',caso:o.name}));
 let reason=null;
 if(criterion==='distribucion')reason='La evidencia demuestra distribución/desbordamiento en el viewport base, pero no todas las señales de contraste/estados y visibilidad del campo frente a pies/encabezados que exige esta celda amplia. Conservarla como apoyo parcial; no retirar los controles externos independientes.';
 if(row.id==='M21'&&v.viewport==='desktop'&&criterion==='apertura_cierre')reason='El informe admite apertura inicial desktop por destino directo tras un intento transitorio. Descarte en segunda apertura no demuestra todo el recorrido de apertura/teclado de esta celda.';
 if(!candidates.length)reason='No se identificaron observaciones del consumidor/viewport correspondientes a esta aprobación. Se requiere referencia precisa o repetición, sin extrapolar otra ruta.';
 const original=JSON.parse(JSON.stringify(cell));
 if(reason){v.celdas[criterion]={estado:'pendiente',motivo:reason,evidencia_parcial:cell.evidencia,aprobacion_anterior:original};}
 else cell.evidencia_consumidor={archivo:'tests/visual-close/review.json',celda:key};
 decisions.push({key,previous:'verificada',state:reason?'pendiente':'verificada',reason:reason||'Consumidor y viewport identificados; afirmación limitada contrastada con informe y observaciones. No acredita variantes pendientes.',candidates:candidates.map(o=>o.name),family});
}
for(const p of new Set(Object.keys(m).filter(k=>k.startsWith('fuentes')).flatMap(k=>Object.keys(m[k])))){try{hashes[p]=createHash('sha256').update(await readFile(new URL(p,root))).digest('hex');}catch{}}
m.fuentes_cierre_20261117=hashes;
m.cierre_20261117={informe:'docs/cierre-matriz-visual.md',metodo:'Auditoría de todas las celdas y aprobación limitada por consumidor/viewport; CUA nueva separada de registros históricos.',global_completa:false,estados_no_ejecutados_conservados:true};
await writeFile(new URL('./matrix-reviewed.json',import.meta.url),JSON.stringify(m,null,2)+'\n');await writeFile(new URL('./review.json',import.meta.url),JSON.stringify({decisions},null,2));
console.log(JSON.stringify({reviewed:decisions.length,downgraded:decisions.filter(x=>x.state==='pendiente').map(x=>x.key)},null,2));
