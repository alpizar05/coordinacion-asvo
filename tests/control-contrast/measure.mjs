// Offline analysis of CUA computed colors. This is measurement, not WCAG certification.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const parse=value=>{const m=value.match(/^rgba?\(([^)]+)\)$/);if(!m)throw Error(`Unsupported color syntax: ${value}`);const a=m[1].split(',').map(Number);return [...a.slice(0,3),a[3]??1];};
const over=(fg,bg)=>[...fg.slice(0,3).map((c,i)=>c*fg[3]+bg[i]*(1-fg[3])),1];
const luminance=c=>c.slice(0,3).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
assert.equal(ratio([0,0,0],[255,255,255]),21);assert.equal(ratio([255,255,255],[255,255,255]),1);
const source=JSON.parse(await readFile(new URL('./measurements.json',import.meta.url),'utf8'));
const rows=[];
for(const sample of source.cases)for(const c of sample.observed.controls){
 let adjacent=[255,255,255,1];for(const layer of [...c.layers].reverse())adjacent=over(parse(layer.bg),adjacent);
 const fill=over(parse(c.bg),adjacent),border=over(parse(c.border),adjacent);
 const modeled=c.opacity==='1'&&c.layers.every(l=>l.opacity==='1');
 rows.push({case:sample.case,tag:c.tag,name:c.name,type:c.type,text:c.text,scope:c.scope,disabled:c.disabled,invalid:c.invalid,border:c.border,fill:c.bg,adjacent,modeled,
 borderAgainstAdjacent:modeled?ratio(border,adjacent):null,borderAgainstFill:modeled?ratio(border,fill):null,fillAgainstAdjacent:modeled?ratio(fill,adjacent):null,
 textAgainstFill:modeled?ratio(over(parse(c.color),fill),fill):null,focusVisible:c.focusVisible,outline:c.outline,appearance:c.appearance,
 note:['checkbox','radio'].includes(c.type)?'CSS values do not measure native painted glyphs. No compliance conclusion.':c.disabled?'Inactive: exempt from SC 1.4.11.':c.tag==='BUTTON'?'Boundary need depends on identifying text/icon; do not apply 3:1 to every border.':c.tag==='SECTION'?'Decorative container; not an input boundary.':'Assess boundary and context manually.'});
}
const find=(name,key)=>rows.find(r=>r.case===name&&r.name===key&&r.scope);
assert.ok(Math.abs(find('before-desktop-initial','empty').borderAgainstAdjacent-1.43)<.01);
for(const name of ['empty','filled','search','number','date','select','detail','file','soft'])assert.ok(find('after-desktop-initial',name).borderAgainstAdjacent>=3);
for(const stage of ['before-desktop-errors','after-desktop-errors'])assert.equal(find(stage,'empty').border,'rgb(133, 47, 36)');
const before=source.cases.find(r=>r.case==='before-desktop-initial').observed.controls,after=source.cases.find(r=>r.case==='after-desktop-initial').observed.controls;
assert.equal(before.length,after.length);
for(let i=0;i<before.length;i++){const b=before[i],a=after[i];assert.equal(a.tag,b.tag);assert.equal(a.name,b.name);if(!b.scope||b.tag==='SECTION'||b.tag==='BUTTON'||b.disabled||['checkbox','radio'].includes(b.type))for(const key of ['border','bg','color','borderWidth'])assert.equal(a[key],b[key]);}
assert.ok(rows.some(r=>r.focusVisible&&r.outline.includes('3px')));
await writeFile(new URL('./ratios.json',import.meta.url),JSON.stringify({date:source.date,formula:'sRGB relative luminance: (Llighter+0.05)/(Ldarker+0.05); alpha composed over ancestor backgrounds, canvas white. Ratios are not rounded for acceptance. Native glyphs/opacity groups require separate assessment.',rows},null,2)+'\n');
console.log(`OK: ${source.cases.length} observations, ${rows.length} control/container readings. Baseline ${find('before-desktop-initial','empty').borderAgainstAdjacent}; corrected ${find('after-desktop-initial','empty').borderAgainstAdjacent}; soft ${find('after-desktop-initial','soft').borderAgainstAdjacent}.`);
