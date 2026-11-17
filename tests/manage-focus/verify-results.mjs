// Validate recorded local browser evidence; this does not launch a browser or assert business persistence.
import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const file=new URL('./results.json',import.meta.url),data=JSON.parse(await readFile(file,'utf8')),cases=new Map(data.cases.map(r=>[r.case,r]));
for(const size of ['desktop','mobile']){
 for(const [flow,name]of [['action-field','reason'],['edit-fields','food']])assert.equal(cases.get(`${size}-${flow}-stable`).observed.focus.name,name);
 for(const flow of ['action-general','edit-general']){const focus=cases.get(`${size}-${flow}-stable`).observed.focus;assert.equal(focus.tag,'DIV');assert.ok(focus.dialog);}
 for(const flow of ['reminder-close','close-escape'])assert.equal(cases.get(`${size}-${flow}`).observed.focus.aria,'Gestionar inscripción de Persona Ficticia');
 const fixed=cases.get(`after-fix-${size}-refreshed-focus`).observed;
 assert.equal(fixed.focus.aria,'Gestionar inscripción de Persona Ficticia');assert.equal(fixed.dialogs.length,0);
 assert.equal(new URL(fixed.url).searchParams.get('serieBuscar'),'Ficticia');assert.equal(new URL(fixed.url).searchParams.get('serieTipo'),'automaticas');assert.equal(new URL(fixed.url).searchParams.get('pestana'),'inscripciones');
 assert.ok(cases.get(`${size}-series-copy`).clipboard.startsWith('http://localhost:3043/colecciones/'));
}
assert.equal(cases.get('mobile-action-success').observed.focus.text,'Persona Ficticia','Recorded pre-fix overwrite of valid trigger');
assert.equal(cases.get('after-fix-mobile-error-priority').observed.focus.name,'food');
assert.equal(cases.get('after-fix-mobile-handoff').observed.focus.dialog,'Editar inscripción');
for(const r of data.cases){assert.equal(new URL(r.observed.url).hostname,'localhost');assert.ok(r.observed.dialogs.length<=1);assert.ok(r.observed.dialogs.every(d=>!d.overflow));}
data.notes=['Only fictitious data and simulated action adapters; no persisted operations or provider calls.','The first fixture retained the original page.tsx: it stopped at local auth configuration validation. Removed that page only in the copy and restarted after manifest cache.','Initial fixture omitted the origin row: desktop-action-success/mobile-edit-success are not product restoration evidence; row-aware reruns corrected the fixture.','Immediate fields/field-error/general readings can be transient. Use *-stable cases for completed validation focus.','mobile-action-success is row-aware pre-fix evidence of focus being replaced by the first origin-row link. after-fix-* records are new verification of the restoration guard.'];
await writeFile(file,JSON.stringify(data,null,2)+'\n');console.log(`OK: ${data.cases.length} local observations; stable error focus, handoff, close, copy and post-refresh trigger verified.`);
