import{readFile,writeFile}from'node:fs/promises';
const root=new URL('../../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const matrix=await read('docs/matriz-visual-consumidores.json'),review=await read('tests/visual-close/review.json'),datasets={};
for(const family of['registry-visual','outing-visual','participation-visual']){const d=await read('tests/'+family+'/results.json');datasets[family]=new Map(await Promise.all(d.cases.map(async c=>[c.name,c.dom?c:await read('tests/'+family+'/'+c.file)])));}
const missing=[];
for(const d of review.decisions){
 const[id,viewport]=d.key.split(':'),row=matrix.recorridos.find(r=>r.id===id),expected=viewport==='desktop'?'1440x900':'390x844';
 const path=row.ruta.split('?')[0],pattern=new RegExp('^'+path.split('/').map(p=>p.startsWith('[')?'[^/]+':p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'$');
 d.excluded_route_or_viewport=[];
 d.candidates=d.candidates.filter(name=>{const o=datasets[d.family].get(name),url=new URL(o.dom.url);const keep=o.dom.viewport.join('x')===expected&&pattern.test(url.pathname);if(!keep)d.excluded_route_or_viewport.push(name);return keep;});
 if(d.state==='verificada'&&!d.candidates.length)missing.push(d.key);
}
await writeFile(new URL('./review.json',import.meta.url),JSON.stringify(review,null,2));console.log(JSON.stringify({without_matching_scope:missing,pruned:review.decisions.reduce((n,d)=>n+d.excluded_route_or_viewport.length,0)}));if(missing.length)process.exitCode=1;
