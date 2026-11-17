/** Offline assertions over captured observations; not an autonomous browser runner. */
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const {cases}=JSON.parse(await readFile(new URL('./results.json',import.meta.url),'utf8'));
const find=name=>{const value=cases.find(x=>x.name===name);assert.ok(value,name);return value;};
const families=['profile','units','policy','incident','attendance','grant','import','policy-import'];
for(const viewport of['desktop','mobile'])for(const family of families){
 const stem=viewport+'-'+family;
 const mixed=find(stem+(stem==='desktop-policy-import'?'-mixed-stable':'-mixed'));
 assert.ok(mixed.dom.invalid.length,stem+' fields');assert.ok(mixed.dom.invalid.every(x=>x.linked),stem+' ARIA');
 assert.match(mixed.ax,/Fallo general simulado/);assert.equal(mixed.dom.overflow,false);
 const success=find(stem+(stem==='desktop-import'?'-persisted-after-fix':'-persisted'));
 assert.equal(success.dom.dialogs.length,0,stem+' close');assert.equal(success.dom.overflow,false);
 if(['profile','units','policy','attendance'].includes(family))assert.equal(success.dom.active.tag,'BUTTON',stem+' return');
}
for(const viewport of['desktop','mobile']){
 const ctx=find(viewport+'-context-restored');assert.match(ctx.dom.url,/buscar=Persona&unidad=BRIF/);assert.equal(ctx.dom.active.tag,'A');
 const report=find(viewport+'-report-regression-hidden-focus');assert.equal(report.dom.active.name,viewport==='desktop'?'actions':'accuracy');
 const pending=find(viewport==='desktop'?'desktop-import-after-fix-pending':'mobile-import-pending');assert.ok(pending.dom.values.filter(x=>x.name==='confirm').every(x=>x.disabled));
}
const states=JSON.parse(await readFile(new URL('./persistence.json',import.meta.url),'utf8'));
const before=states.find(x=>x.stage==='before-preview'),after=states.find(x=>x.stage==='after-preview');
assert.deepEqual(before.counts,after.counts);assert.deepEqual(before.volunteers,after.volunteers);assert.deepEqual(before.policies,after.policies);
const final=states.find(x=>x.stage==='final-audit');assert.equal(final.volunteers.length,4);assert.equal(final.policies.length,4);assert.equal(final.incidents.length,2);assert.equal(final.resolutions.length,2);assert.equal(final.counts.mail,0);assert.equal(final.counts.demo_mail,0);
assert.equal(new Set(final.volunteers.map(x=>x.identification)).size,4);assert.ok(final.volunteers.every(x=>x.units.includes('Voluntariado General')));assert.ok(final.auditActions.every(x=>x.n===2));
console.log('OK: 16 combinaciones de consumidores, ARIA, errores/éxito, contexto, regresión, preview sin escrituras, persistencia y cola vacía. Solo evidencia capturada, no navegador autónomo.');
