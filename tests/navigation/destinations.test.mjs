import test from 'node:test';import assert from 'node:assert/strict';
import {navigationDestination as normalize,preserveNavigationUrl,navigationCriteria,navigationResetList,navigationTrail,validListContext,cleanNavigationContext} from '../../lib/navigation-context.ts';
import {id,frame,context} from './fixtures.mjs';
test('canonical criteria order and omission of transient flags/tokens',()=>{
 assert.equal(normalize('/coordinacion/inscripciones?hasta=2035-01-31&unidad=UEA&estado=revisión&navContext=secret&error=text&token=secret'),'/coordinacion/inscripciones?estado=revisi%C3%B3n&unidad=UEA&hasta=2035-01-31');
 assert.equal(normalize('/coordinacion/registro?buscar=Ana&pagina=3&unidad=UEA'),'/coordinacion/registro?buscar=Ana&unidad=UEA&pagina=3');
});
test('every active destination family is explicitly allowed',()=>{
 for(const path of ['/coordinacion/convocatorias','/coordinacion/informes','/coordinacion/registro',`/coordinacion/registro/${id(1)}`,`/coordinacion/salidas/${id(1)}`,`/coordinacion/salidas/${id(1)}/resumen`,`/coordinacion/colecciones/automaticas/${id(1)}`,`/coordinacion/colecciones/manuales/${id(1)}`])assert.equal(normalize(path),path);
});
test('rejects external, ambiguous, malformed, control and nonallowlisted destinations',()=>{
 for(const input of [null,undefined,12,'https://evil.invalid','//evil.invalid','/privado/token','/api/auth/signout','/coordinacion/administracion','/coordinacion/inscripciones#anchor','/coordinacion/registro/../inscripciones','/coordinacion/%2e%2e/inscripciones','/coordinacion/inscripciones\\evil','/coordinacion/inscripciones?estado=x&estado=y','/coordinacion/registro?buscar=%00',`/coordinacion/registro/${'-'.repeat(36)}`,'/coordinacion/registro?buscar='+ 'x'.repeat(151)])assert.equal(normalize(input),null,String(input));
});
test('same-detail editing keeps only criteria and opaque navigation identifier',()=>{
 const path=`/coordinacion/salidas/${id(1)}`;
 assert.equal(preserveNavigationUrl(path+'?editar=1',path+`?pestana=logistica&estado=confirmada&navContext=${id(2)}&token=secret`),path+`?editar=1&estado=confirmada&pestana=logistica&navContext=${id(2)}`);
 assert.equal(preserveNavigationUrl('https://evil.invalid',path),path);
 assert.equal(preserveNavigationUrl('/privado/token',path),path);
 assert.equal(preserveNavigationUrl('http://[',path),path);
 assert.equal(preserveNavigationUrl('https://evil.invalid','/not-allowed'),'/coordinacion');
});
test('criteria changes distinguish filters/pages from sections, and distinguish both overview tables',()=>{
 assert.equal(navigationCriteria(`/coordinacion/salidas/${id(1)}?pestana=logistica`),navigationCriteria(`/coordinacion/salidas/${id(1)}?pestana=inscripciones`));
 assert.notEqual(navigationCriteria('/coordinacion/registro?pagina=1'),navigationCriteria('/coordinacion/registro?pagina=2'));
 assert.equal(navigationResetList('/coordinacion/convocatorias','/coordinacion/convocatorias?serieTipo=manuales'),'series');
 assert.equal(navigationResetList('/coordinacion/convocatorias','/coordinacion/convocatorias?salidaOrden=starts%3Aasc'),'outings');
});
test('bounded flat trails prune ancestors instead of introducing cycles',()=>{
 const root=frame(),outing=frame(2,{destination:`/coordinacion/salidas/${id(1)}`}),person=frame(3,{destination:`/coordinacion/registro/${id(2)}`});
 assert.deepEqual(navigationTrail([root],outing,person.destination),[root,outing]);
 assert.deepEqual(navigationTrail([root,outing],person,outing.destination),[root]);
 assert.deepEqual(navigationTrail([],outing,outing.destination),[]);
 assert.deepEqual(navigationTrail(Array(8).fill(root),outing,person.destination),[]);
});
test('contexts reject bad shape, duplicates, future/expired time and excessive neighbors',()=>{
 const c=context();assert.ok(validListContext(c,c.time));
 for(const bad of [{...c,time:-1_000_000},{...c,time:c.time+1},{...c,frames:[]},{...c,frames:[frame(),frame()]},{...c,frames:[frame(1,{neighbors:Array(17).fill(id(2))})]},{...c,frames:[frame(1,{y:NaN})]}])assert.ok(!validListContext(bad,c.time));
 const clean=cleanNavigationContext({...c,token:'PRIVATE',form:{email:'private'},frames:[{...frame(),policy:'medical'}]},c.time);
 assert.ok(!JSON.stringify(clean).includes('PRIVATE'));assert.ok(!JSON.stringify(clean).includes('medical'));
});
test('context labels and list reset mapping cover each active family',async()=>{
 const {navigationLabel,registrationListDestination}=await import('../../lib/navigation-context.ts');
 for(const [path,text]of [['/coordinacion/inscripciones','solicitudes de inscripción'],['/coordinacion/informes','informes de salida'],['/coordinacion/registro','voluntariado'],['/coordinacion/convocatorias','convocatorias de salida'],[`/coordinacion/colecciones/manuales/${id(1)}`,'convocatoria en serie'],[`/coordinacion/registro/${id(1)}`,'participaciones de la persona voluntaria'],[`/coordinacion/salidas/${id(1)}`,'inscripciones de la salida']])assert.ok(navigationLabel(path).includes(text));
 assert.equal(registrationListDestination('/coordinacion/informes'),null);assert.equal(registrationListDestination('/coordinacion/inscripciones'),'/coordinacion/inscripciones');
 for(const[path,list]of [['/coordinacion/registro','volunteers'],['/coordinacion/informes','reports'],['/coordinacion/inscripciones','requests'],[`/coordinacion/salidas/${id(1)}`,'outing-registrations']])assert.equal(navigationResetList(path,path),list);
 assert.equal(navigationResetList('/coordinacion/registro','/coordinacion/administracion'),undefined);
});
test('Summary and logistics keep approved criteria, distinct labels and unique anchors only',async()=>{
 const {navigationLabel}=await import('../../lib/navigation-context.ts');
 const summary='/coordinacion?unidad=UEA&dias=14&pestana=informes';
 assert.equal(normalize('/coordinacion?pestana=informes&dias=14&unidad=UEA&token=private'),summary);
 assert.equal(navigationLabel(summary),'Volver a Resumen');
 assert.notEqual(navigationCriteria(summary),navigationCriteria('/coordinacion?unidad=UEA&dias=14&pestana=revision'));
 assert.equal(navigationResetList(summary,summary),'summary-attention');
 for(const section of ['transporte','alimentacion']){
  const destination=`/coordinacion/salidas/${id(1)}?pestana=logistica&desglose=${section}`;
  assert.equal(normalize(destination),destination);assert.equal(navigationLabel(destination),'Volver a logística de la salida');
  assert.equal(navigationCriteria(destination),`/coordinacion/salidas/${id(1)}`);
  const c=context(Date.now(),{frames:[frame(1,{destination,anchor:`${section}-${id(2)}`,panelY:120})]});
  const clean=cleanNavigationContext({...c,frames:[{...c.frames[0],email:'private',alimentacion:'private'}]},c.time);
  assert.equal(clean.frames[0].panelY,120);assert.ok(!JSON.stringify(clean).includes('private'));
  assert.equal(cleanNavigationContext({...c,frames:[{...c.frames[0],panelY:-1}]},c.time),null);
 }
 assert.equal(normalize(`/coordinacion/salidas/${id(1)}?desglose=medical`),null);
 for(const prefix of ['summary-review','summary-no-lead','summary-report','summary-upcoming'])assert.ok(validListContext(context(Date.now(),{frames:[frame(1,{destination:summary,anchor:`${prefix}-${id(2)}`})]})));
 assert.ok(validListContext(context(Date.now(),{detail:'/coordinacion/convocatorias',frames:[frame(1,{destination:summary})]})));
});
