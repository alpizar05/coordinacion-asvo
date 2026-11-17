// Offline checks of recorded evidence and audit decisions, not an autonomous CUA runner.
import{test}from'node:test';import assert from'node:assert/strict';import{readFile,readdir}from'node:fs/promises';import{existsSync}from'node:fs';import{createHash}from'node:crypto';
const root=new URL('../../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const m=await read('docs/matriz-visual-consumidores.json'),before=await read('tests/visual-close/matrix-before.json'),review=await read('tests/visual-close/review.json');
const historical={};for(const family of ['registry-visual','outing-visual','participation-visual']){const data=await read('tests/'+family+'/results.json');historical[family]=new Map(await Promise.all(data.cases.map(async c=>[c.name,c.dom?c:await read('tests/'+family+'/'+c.file)])));}
const{cases}=await read('tests/visual-close/results.json');const observations=new Map(await Promise.all(cases.map(async c=>[c.name,await read('tests/visual-close/'+c.file)])));
function cells(matrix){const result=new Map();for(const r of matrix.recorridos)for(const v of r.vistas)for(const[k,c]of Object.entries(v.celdas))result.set(r.id+':'+v.viewport+':'+k,c);return result;}
test('all 1032 cells accounted for; only 41 unsupported approvals changed, no pending or blocked promoted',()=>{
 const current=cells(m),old=cells(before),states={};assert.equal(current.size,1032);
 let changed=0;for(const[key,cell]of current){states[cell.estado]=(states[cell.estado]||0)+1;const previous=old.get(key);assert.ok(previous);if(previous.estado!==cell.estado){changed++;assert.equal(previous.estado,'verificada');assert.equal(cell.estado,'pendiente');assert.ok(key.endsWith(':distribucion')||key==='M21:desktop:apertura_cierre');assert.deepEqual(cell.aprobacion_anterior,previous);}if(previous.estado==='bloqueada')assert.deepEqual(cell,previous);}
 assert.equal(changed,41);assert.deepEqual(states,{pendiente:478,'no aplicable':204,verificada:349,bloqueada:1});
});
test('each retained approval points to observations of its consumer and viewport, with explicit role scope',async()=>{
 for(const[key,cell]of cells(m)){if(cell.estado!=='verificada')continue;assert.ok(cell.fecha&&cell.revision&&cell.metodo);assert.ok(cell.alcance_cierre.rol_cua);const d=review.decisions.find(x=>x.key===key);assert.ok(d?.candidates.length,key);assert.equal(d.state,'verificada');const row=m.recorridos.find(r=>r.id===key.split(':')[0]);const expected=key.includes(':desktop:')?'1440x900':'390x844';const pattern=new RegExp('^'+row.ruta.split('?')[0].split('/').map(p=>p.startsWith('[')?'[^/]+':p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'$');for(const name of d.candidates){const o=historical[d.family].get(name);assert.ok(o,name);assert.equal(o.dom.viewport.join('x'),expected,name);assert.ok(pattern.test(new URL(o.dom.url).pathname),key+' '+name);}}
});
test('92 new observations and 57 captures: both viewports, linked errors and no private URLs/overflow',async()=>{
 assert.equal(cases.length,92);assert.equal(observations.size,92);const dimensions=new Set();
 for(const[name,o]of observations){dimensions.add(o.dom.viewport.join('x'));assert.equal(o.dom.overflow,false,name);assert.ok(o.dom.invalid.every(x=>x.linked),name);assert.doesNotMatch(JSON.stringify(o),/(?:\/resumen-salida\/|invitacion=)[\w-]{43}/);}
 assert.deepEqual([...dimensions].sort(),['1440x900','390x844']);assert.equal((await readdir(new URL('./evidence/',import.meta.url))).filter(n=>n.endsWith('.png')).length,57);
});
test('pending blocks controls effectively, including inherited fieldsets and photo tabs',()=>{
 for(const name of['desktop-summary-fixed-pending','mobile-summary-fixed-pending','desktop-profile-pending-escape','mobile-profile-rejection-pending','mobile-photo-preparation-pending','desktop-photo-pending-file-kept','mobile-report-draft-pending']){
 const d=observations.get(name).dom;const controls=d.effectiveControls;assert.ok(controls.some(c=>c.disabledEffective),name);assert.ok(d.buttons.some(b=>b.disabled)||controls.some(c=>/Guardando/.test(c.text||'')&&c.disabledEffective),name);}
 const photo=observations.get('mobile-photo-rejection-pending-tabs').dom;assert.ok(photo.buttons.filter(x=>['Galería','Subir nueva'].includes(x.text)).every(x=>x.disabled));
 const file=observations.get('mobile-photo-rejection-file-retained').dom.values.find(x=>x.type==='file');assert.match(file.value,/fictitious\.png$/);
});
test('reproduced BODY focus is fixed in both sizes; hidden errors and contextual origin retain priority',()=>{
 for(const name of['mobile-summary-confirmed-next-row','desktop-summary-before-fix-body'])assert.equal(observations.get(name).dom.active.tag,'BODY');
 for(const name of['desktop-summary-fixed-next-row','mobile-summary-fixed-next-row','mobile-logistics-context-return','desktop-logistics-context-return','mobile-summary-context-restored','desktop-summary-context-restored'])assert.equal(observations.get(name).dom.active.tag,'A',name);
 assert.equal(observations.get('desktop-report-hidden-actions-focus').dom.active.name,'actions');assert.equal(observations.get('mobile-report-hidden-accuracy-focus').dom.active.name,'accuracy');
 assert.equal(observations.get('desktop-profile-independent-correction').dom.invalid.length,1);assert.equal(observations.get('desktop-profile-independent-correction').dom.invalid[0].name,'email');
});
test('actual local commits are separate from prepared photos and rejected report payload',async()=>{
 const d=await read('tests/visual-close/persistence-final.json');
 for(const family of['participation-visual','outing-visual','registry-visual']){assert.equal(d[family].version,'18.7');assert.deepEqual(d[family].outbox,{n:0,accepted:0});}
 const p=d['participation-visual'];assert.equal(p.registrations.length,29);assert.equal(p.reports.length,0);assert.equal(p.demo.n,6);assert.equal(p.audit.find(a=>a.action==='Confirmó cupo').n,4);assert.equal(new Set(p.registrations.map(r=>r.outing_id+':'+r.volunteer_id)).size,p.registrations.length);
 const r=d['registry-visual'];assert.equal(r.volunteers.find(v=>v.id.endsWith('000000000101')).whatsapp,'80000002');assert.equal(r.audit.find(a=>a.action==='Corrigió ficha').n,1);assert.ok(r.volunteers.every(v=>v.units.includes('Voluntariado General')));
 const o=d['outing-visual'];assert.equal(o.audit.length,0);assert.equal(o.photos.find(p=>p.outing_id.endsWith('000000000013')).n,1);
});
test('fixtures removed; revision hashes tie this audit to current sources',async()=>{
 const cleanup=await read('tests/visual-close/cleanup.json');assert.ok(cleanup.tab_closed&&cleanup.viewport_reset);for(const f of cleanup.fixtures){assert.equal(existsSync(new URL('tests/'+f.family+'/active.json',root)),false);assert.equal(existsSync(f.temp),false);}
 const rev=await read('tests/visual-close/revision.json');for(const[file,hash]of Object.entries(rev.sources))assert.equal(createHash('sha256').update(await readFile(new URL(file,root))).digest('hex'),hash,file);
});
