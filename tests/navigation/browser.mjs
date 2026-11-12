/** Automated navigation checks using the documented CUA tab API; no browser dependency or secret is imported. */
const check=(condition,message)=>{if(!condition)throw Error(message);};
export function createNavigationBrowserSuite({tab,fixture,createTab,viewport}){
 const base='http://localhost:3031',report=[];
 const requests='/coordinacion/inscripciones?estado=todos&desde=2035-01-01&hasta=2035-01-31';
 const row=n=>tab.playwright.locator(`#inscripcion-${fixture.entries[n-1]}`);
 const person=n=>`Navegacion Prueba ${String(n).padStart(2,'0')}`;
 async function visible(locator){let error;for(let i=0;i<4;i++){try{await locator.waitFor({state:'visible',timeoutMs:10000});return;}catch(e){error=e;}}throw error;}
 async function url(value){let error;for(let i=0;i<4;i++){try{await tab.playwright.waitForURL(value,{timeoutMs:10000});return;}catch(e){error=e;}}throw error;}
 async function go(path){check(path==='/coordinacion'||path.startsWith('/coordinacion?')||path.startsWith('/coordinacion/'),'Only local Coordination paths');await tab.goto(base+path);await visible(tab.playwright.getByRole('heading',{level:1}).first());check(await tab.playwright.locator('.coordination-content[data-navigation-demo="true"]').count()===1,'Refusing an app that is not in demo mode');}
 async function link(locator,keyboard=false,tracked=true,expected){
  if(tracked)locator=locator.and(tab.playwright.locator('a[href*="navContext="]'));
  await visible(locator);const href=await locator.getAttribute('href');check(href==='/coordinacion'||href?.startsWith('/coordinacion?')||href?.startsWith('/coordinacion/'),'Only internal destinations');
  const state=await tab.getAXState({emit:false,disableDiffing:true});
  let entry=state.split('\n').find(line=>/^\s*\d+ link /.test(line)&&line.includes('Value: localhost:3031'+href));
  if(!entry){
   const match=await locator.evaluate(e=>({name:e.textContent.trim(),path:e.pathname,ordinal:[...document.querySelectorAll('a')].filter(a=>a.textContent.trim()===e.textContent.trim()&&a.getClientRects().length).indexOf(e)}));
   entry=state.split('\n').filter(line=>/^\s*\d+ link /.test(line)&&line.includes('Description: '+match.name+', Value: '))[match.ordinal];
  }
  check(entry,'Native link is absent from accessibility tree');const index=Number(entry.trim().match(/^\d+/)[0]);
  if(keyboard)await tab.pressKey(index,'Return');else await tab.click(index);
  const goal=new URL(href,base);if(goal.hash.startsWith('#inscripcion-'))goal.searchParams.set('pestana','inscripciones');
  await url(expected??goal.href);await tab.playwright.domSnapshot();return href;
 }
 async function back(name){return link(tab.playwright.getByRole('link',{name:'‹ '+name,exact:true}),false,false);}
 async function focused(name){const target=tab.playwright.getByRole('link',{name,exact:true}).and(tab.playwright.locator(':focus'));await visible(target);const rect=await target.evaluate(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,height:innerHeight}));check(rect.bottom>0&&rect.top<rect.height,'Focused record is outside viewport');}
 async function note(name,run){await run();report.push({name,status:'passed'});return report.at(-1);}
 return {report,
  basics:()=>note('contextual return, reload, keyboard and native Back/Forward',async()=>{
   check(new URL(await tab.url()).origin===base,'Refusing nonlocal browser');
   await go(requests);const detail=await link(row(6).getByRole('link',{name:person(6),exact:true}),true);
   await visible(tab.playwright.getByRole('link',{name:'‹ Volver a solicitudes de inscripción',exact:true}));
   await tab.reload();await tab.playwright.domSnapshot();await back('Volver a solicitudes de inscripción');await focused(person(6));
   const y=await tab.playwright.evaluate(()=>scrollY);check(y>0,'Context return lost scroll');
   await link(row(6).getByRole('link',{name:person(6),exact:true}));const actual=await tab.url();
   await tab.back();await url(base+requests);await tab.playwright.domSnapshot();check(Math.abs((await tab.playwright.evaluate(()=>scrollY))-y)<8,'Native back lost scroll');
   await tab.forward();await url(actual);await visible(tab.playwright.getByRole('link',{name:'‹ Volver a solicitudes de inscripción',exact:true}));await back('Volver a solicitudes de inscripción');
   return detail;
  }),
  independent:()=>note('direct entry and independent tab use the normal fallback',async()=>{
   const path=`/coordinacion/registro/${fixture.people[5]}`;await go(path);check(await tab.playwright.getByRole('link',{name:/‹ Volver a/}).count()===0,'Direct entry fabricated a context');
   await go(requests);const detail=await link(row(6).getByRole('link',{name:person(6),exact:true}));
   const other=await createTab(base+detail);try{await other.playwright.domSnapshot();check(await other.playwright.getByRole('link',{name:/‹ Volver a/}).count()===0,'Independent tab inherited an unavailable context');}finally{await other.close();}
   await back('Volver a solicitudes de inscripción');
  }),
  chain:()=>note('list → outing → person → outing → list, plus fragment target',async()=>{
   await go(requests);await link(row(6).getByRole('link',{name:'DEMO Navegación · Inscripciones',exact:true}));
   check((await tab.url()).includes('#inscripcion-'),'Outing fragment was removed');
   await link(tab.playwright.getByRole('link',{name:person(6),exact:true}));await back('Volver a inscripciones de la salida');await focused(person(6));
   await back('Volver a solicitudes de inscripción');await focused(person(6));
  }),
  participations:()=>note('Voluntariado criteria, participation section and memory-only search on reload',async()=>{
   await go('/coordinacion/registro?buscar=Navegacion&unidad=Voluntariado%20General');await link(tab.playwright.getByRole('link',{name:person(6),exact:true}));
   await tab.playwright.getByRole('button',{name:'Participaciones',exact:true}).click();await visible(tab.playwright.getByRole('region',{name:'Participaciones',exact:true}));
   await link(tab.playwright.getByRole('link',{name:'DEMO Navegación · Inscripciones',exact:true}));await back('Volver a participaciones de la persona voluntaria');
   check((await tab.url()).includes('seccion=participations'),'Participation section was lost');await visible(tab.playwright.getByRole('region',{name:'Participaciones',exact:true}));
   await back('Volver a voluntariado');check((await tab.url()).includes('buscar=Navegacion'),'Volunteer search lost');
   await link(tab.playwright.getByRole('link',{name:person(6),exact:true}));await tab.reload();await tab.playwright.domSnapshot();check(await tab.playwright.getByRole('link',{name:'‹ Volver a voluntariado',exact:true}).count()===0,'Search text was unexpectedly persisted across reload');
  }),
  series:()=>note('automatic/manual series, blocks and independent overview criteria',async()=>{
   for(const [kind,id,title] of [['manuales',fixture.manual,'DEMO Navegación · Serie manual'],['automaticas',fixture.request,null]]){
    await go(`/coordinacion/convocatorias?salidaBuscar=DEMO%20Navegaci%C3%B3n&serieTipo=${kind}`);
    const table=tab.playwright.getByRole('table',{name:'Convocatorias en serie',exact:true});
    const item=title?table.getByRole('link',{name:title,exact:true}):table.locator(`a[href*="/automaticas/${id}"]`);
    await link(item);await visible(tab.playwright.getByRole('link',{name:'‹ Volver a convocatorias en serie',exact:true}));
    await link(tab.playwright.locator(`a[href*="/salidas/${fixture.outing}"]`).first());await back('Volver a la convocatoria en serie');await back('Volver a convocatorias en serie');
    const result=new URL(await tab.url());check(result.searchParams.get('serieTipo')===kind&&result.searchParams.get('salidaBuscar')==='DEMO Navegación','Series criteria were mixed or lost');
   }
  }),
  reports:()=>note('report list → report summary → list with date criteria',async()=>{
   await go('/coordinacion/informes?estado=borrador&desde=2035-01-01&hasta=2035-01-31');
   await link(tab.playwright.getByRole('row').filter({hasText:'Navegacion Prueba 01'}).getByRole('link',{name:'Ver informe',exact:true}));
   await tab.reload();await tab.playwright.domSnapshot();await back('Volver a informes de salida');
   const result=new URL(await tab.url());check(result.searchParams.get('estado')==='borrador'&&result.searchParams.get('desde')==='2035-01-01','Report criteria lost');
  }),
  mobileMutations:()=>note('mobile confirmation/removal, validation focus and retry',async()=>{
   await viewport.set({width:390,height:844});await go('/coordinacion/inscripciones?estado=revisi%C3%B3n&desde=2035-01-01&hasta=2035-01-31');
   await tab.playwright.getByRole('button',{name:`Gestionar inscripción de ${person(3)}`,exact:true}).click();await tab.playwright.getByRole('button',{name:'Confirmar cupo',exact:true}).click();await tab.playwright.getByRole('button',{name:'Confirmar cupo',exact:true}).click();await focused(person(4));
   await tab.playwright.getByRole('button',{name:`Gestionar inscripción de ${person(4)}`,exact:true}).click();await tab.playwright.getByRole('button',{name:'Cancelar inscripción',exact:true}).click();await tab.playwright.getByRole('button',{name:'Cancelar inscripción',exact:true}).click();
   const input=tab.playwright.getByRole('textbox',{name:'Motivo',exact:true});await visible(input.and(tab.playwright.locator(':focus')));check(await input.getAttribute('aria-invalid')==='true','Reason error is not accessible');
   const described=await input.getAttribute('aria-describedby');check(!!described,'Reason error has no description');
   await input.fill('Cancelación ficticia de auditoría');await tab.playwright.getByRole('button',{name:'Cancelar inscripción',exact:true}).click();await focused(person(5));
   check(!(await tab.playwright.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'Mobile horizontal overflow');
   await viewport.reset();
  }),
  savedVisible:()=>note('save with Todos preserves an existing record',async()=>{
   await go(requests);await tab.playwright.getByRole('button',{name:`Gestionar inscripción de ${person(5)}`,exact:true}).click();await tab.playwright.getByRole('button',{name:'Confirmar cupo',exact:true}).click();await tab.playwright.getByRole('button',{name:'Confirmar cupo',exact:true}).click();await focused(person(5));
   check(await tab.playwright.locator('table[data-navigation-list="requests"] tbody tr[id]').count()===6,'Unfiltered record unexpectedly disappeared');
  }),
  emptyResults:()=>note('mobile empty result set preserves filters and an accessible focus target',async()=>{
   await viewport.set({width:390,height:844});await go(requests);
   await tab.playwright.getByRole('button',{name:`Gestionar inscripción de ${person(3)}`,exact:true}).click();await tab.playwright.getByRole('button',{name:'Pasar a lista de espera',exact:true}).click();await tab.playwright.getByRole('textbox',{name:'Motivo',exact:true}).fill('Espera ficticia de auditoría');await tab.playwright.getByRole('button',{name:'Pasar a lista de espera',exact:true}).click();
   await focused(person(3));await go('/coordinacion/inscripciones?estado=espera&desde=2035-01-01&hasta=2035-01-31');
   await tab.playwright.getByRole('button',{name:`Gestionar inscripción de ${person(3)}`,exact:true}).click();await tab.playwright.getByRole('button',{name:'Rechazar solicitud',exact:true}).click();await tab.playwright.getByRole('textbox',{name:'Motivo',exact:true}).fill('Último resultado ficticio');await tab.playwright.getByRole('button',{name:'Rechazar solicitud',exact:true}).click();
   await visible(tab.playwright.getByRole('region',{name:'Tabla de solicitudes de inscripción',exact:true}).and(tab.playwright.locator(':focus')));
   check(await tab.playwright.locator('table[data-navigation-list="requests"] tbody tr[id]').count()===0,'Expected an empty list');check(new URL(await tab.url()).searchParams.get('estado')==='espera','Empty list changed criteria');
   await tab.playwright.getByRole('button',{name:'Filtrar inscripciones · filtros activos',exact:true}).click();await tab.playwright.getByRole('combobox',{name:'Estado',exact:true}).selectOption('todos');await tab.playwright.getByRole('button',{name:'Ver resultados',exact:true}).click();
   await visible(tab.playwright.getByRole('link',{name:person(6),exact:true}));check(await tab.playwright.getByRole('dialog').count()===0,'Filter modal did not close');await viewport.reset();
  }),
  deletion:()=>note('deleting a fixture outing returns to its filtered source and neighbor',async()=>{
   await go('/coordinacion/convocatorias?salidaBuscar=DEMO%20Navegaci%C3%B3n');
   const origin=tab.playwright.getByRole('region',{name:'Tabla de convocatorias',exact:true}).getByRole('link',{name:'DEMO Navegación · Eliminar',exact:true});
   const neighbor=await origin.evaluate(e=>{const row=e.closest('tr');return (row.nextElementSibling??row.previousElementSibling)?.querySelector('a')?.textContent;});
   await link(origin);await link(tab.playwright.getByRole('link',{name:'Editar salida',exact:true}));
   await tab.playwright.getByRole('button',{name:'Publicación',exact:true}).click();await tab.playwright.getByText('Acciones de la convocatoria',{exact:true}).click();await tab.playwright.getByRole('checkbox',{name:'Confirmo que quiero eliminar esta convocatoria.',exact:true}).check();await tab.playwright.getByRole('button',{name:'Eliminar convocatoria',exact:true}).click();
   await focused(neighbor);check(new URL(await tab.url()).searchParams.get('salidaBuscar')==='DEMO Navegación','Deletion lost its source criteria');
  }),
  accessibility:()=>note('keyboard/error summary, accessible descriptions and modal focus priority',async()=>{
   await go(requests);await tab.playwright.getByRole('button',{name:`Gestionar inscripción de ${person(2)}`,exact:true}).click();await tab.playwright.getByRole('button',{name:'Cancelar inscripción',exact:true}).click();await tab.playwright.getByRole('button',{name:'Cancelar inscripción',exact:true}).click();
   const input=tab.playwright.getByRole('textbox',{name:'Motivo',exact:true});await visible(input.and(tab.playwright.locator(':focus')));
   const connected=await input.evaluate(e=>({invalid:e.getAttribute('aria-invalid'),messages:(e.getAttribute('aria-describedby')??'').split(' ').filter(Boolean).map(id=>document.getElementById(id)?.textContent??null)}));
   check(connected.invalid==='true'&&connected.messages.every(Boolean)&&connected.messages.join(' ').includes('motivo'),'Error association is incomplete');
   const ax=await tab.getAXState({emit:false,disableDiffing:true});check(ax.includes('Motivo')&&ax.includes('Indicá el motivo'),'Error missing from accessibility tree');
   await tab.playwright.getByRole('button',{name:/Motivo: Indicá el motivo/}).click();await visible(input.and(tab.playwright.locator(':focus')));await tab.pressKey(null,'Escape');
   check(await tab.playwright.getByRole('dialog').count()===0,'Escape failed to close the panel');
  }),
  sections:()=>note('section hash, sticky mobile header, native Back and filter modal do not fight restoration',async()=>{
   await viewport.set({width:390,height:844});const start=`/coordinacion/salidas/${fixture.outing}?pestana=herramientas`;await go(start);
   const state=await tab.getAXState({emit:false,disableDiffing:true});const item=state.split('\n').find(l=>/^\s*\d+ link /.test(l)&&l.includes('Value: localhost:3031'+start+'#inscripciones'));check(item,'Section link absent');await tab.click(Number(item.trim().match(/^\d+/)[0]));
   await visible(tab.playwright.getByRole('tabpanel',{name:'Inscripciones',exact:true}));await tab.playwright.domSnapshot();
   const target=await tab.playwright.getByRole('heading',{name:'Inscripciones',exact:true}).evaluate(e=>({top:e.getBoundingClientRect().top,header:document.querySelector('.site-header').getBoundingClientRect().bottom}));check(target.top>=target.header-1,'Section target hidden below sticky header');
   await tab.back();await url(base+start);await visible(tab.playwright.getByRole('tabpanel',{name:'Herramientas',exact:true}));
   await tab.playwright.getByRole('tab',{name:'Inscripciones',exact:true}).click();await tab.playwright.getByRole('button',{name:'Filtrar inscripciones',exact:true}).click();await tab.playwright.getByRole('combobox',{name:'Estado de inscripción',exact:true}).selectOption('revisión');await tab.playwright.getByRole('button',{name:'Ver resultados',exact:true}).click();
   await visible(tab.playwright.getByRole('tabpanel',{name:'Inscripciones',exact:true}));check(new URL(await tab.url()).searchParams.get('estado')==='revisión','Filter after native history was lost');await viewport.reset();
  }),

  summaryDefaults:()=>note('Summary existing preferences initialize explicit criteria without a filter-scroll jump',async()=>{
   await go('/coordinacion');await url(base+'/coordinacion?**dias=**pestana=**');await tab.playwright.domSnapshot();
   const result=new URL(await tab.url());check(result.pathname==='/coordinacion'&&result.searchParams.has('dias')&&result.searchParams.has('pestana'),'Default Summary criteria not materialized');
   check(await tab.playwright.evaluate(()=>scrollY)===0,'Preference initialization scrolled as a filter change');
  }),
  summary:()=>note('Summary trays, combined criteria, reload and consultation list return',async()=>{
   for(const [view,prefix,key,title]of [['revision','summary-review',fixture.summaryEntries[2],'DEMO Navegación · Resumen'],['sin70','summary-no-lead',fixture.summaryOuting,'DEMO Navegación · Resumen'],['informes','summary-report',fixture.pastOuting,'DEMO Navegación · Informe pendiente']]){
    await go(`/coordinacion?unidad=Voluntariado%20General&dias=14&pestana=${view}`);
    await link(tab.playwright.locator(`#${prefix}-${key}`).getByRole('link',{name:title,exact:true}),true);
    await visible(tab.playwright.getByRole('link',{name:'‹ Volver a Resumen',exact:true}));
    await tab.reload();await tab.playwright.domSnapshot();await back('Volver a Resumen');await focused(title);
    const result=new URL(await tab.url());check(result.searchParams.get('dias')==='14'&&result.searchParams.get('unidad')==='Voluntariado General'&&result.searchParams.get('pestana')===view,'Summary criteria lost');
   }
   await link(tab.playwright.getByRole('link',{name:'Ver convocatorias de salida',exact:true}));await back('Volver a Resumen');
  }),
  logistics:()=>note('Summary → outing → transport/food → person, desktop disclosure and ancestors',async()=>{
   await go('/coordinacion?unidad=Voluntariado%20General&dias=30&pestana=sin70');
   await link(tab.playwright.locator(`#summary-upcoming-${fixture.summaryOuting}`).getByRole('link',{name:'DEMO Navegación · Resumen',exact:true}));
   await tab.playwright.getByRole('tab',{name:'Logística',exact:true}).click();
   for(const [code,list,title]of [['transporte','transport','Ver transporte'],['alimentacion','food','Ver restricciones']]){
    await tab.playwright.locator(`[data-navigation-list-container="${list}"] summary`).click();
    const source=tab.playwright.locator(`#${code}-${fixture.summaryEntries[1]}`).getByRole('link',{name:person(2),exact:true});
    await link(source,true);await visible(tab.playwright.getByRole('link',{name:'‹ Volver a logística de la salida',exact:true}));
    await tab.reload();await tab.playwright.domSnapshot();await back('Volver a logística de la salida');await focused(person(2));
    check(new URL(await tab.url()).searchParams.get('desglose')===code,'Disclosure criterion lost');
    check(await tab.playwright.locator(`[data-navigation-list-container="${list}"] details`).getAttribute('open')!==null,'Disclosure not reopened');
   }
   await back('Volver a Resumen');await focused('DEMO Navegación · Resumen');
  }),
  mobileLogistics:()=>note('mobile transport and food dialogs reopen with row focus; history/direct-tab fallback',async()=>{
   await viewport.set({width:390,height:844});
   for(const [code,title]of [['transporte','Ver transporte'],['alimentacion','Ver restricciones']]){
    await go('/coordinacion?unidad=Voluntariado%20General&dias=7&pestana=sin70');
    await link(tab.playwright.locator(`#summary-upcoming-${fixture.summaryOuting}`).getByRole('link',{name:'Ver logística',exact:true}));
    await tab.playwright.getByRole('button',{name:title,exact:true}).click();
    await visible(tab.playwright.getByRole('dialog',{name:title,exact:true}));
    await link(tab.playwright.locator(`#${code}-${fixture.summaryEntries[1]}`).getByRole('link',{name:person(2),exact:true}));
    await back('Volver a logística de la salida');await visible(tab.playwright.getByRole('dialog',{name:title,exact:true}));await focused(person(2));
    const info=await tab.playwright.evaluate(()=>({ids:[...document.querySelectorAll('[id]')].map(e=>e.id),width:document.documentElement.scrollWidth,viewport:innerWidth}));check(new Set(info.ids).size===info.ids.length,'Duplicate DOM IDs');check(info.width<=info.viewport,'Mobile overflow');
    await tab.pressKey(null,'Escape');await tab.playwright.domSnapshot();check(!new URL(await tab.url()).searchParams.has('desglose'),'Closing retained disclosure');
    await back('Volver a Resumen');await focused('DEMO Navegación · Resumen');
   }
   await viewport.reset();
  }),

  logisticsBeforeRemoval:(code='transporte')=>note(`capture ${code} origin before fictitious record disappears`,async()=>{
   await go(`/coordinacion/salidas/${fixture.summaryOuting}?pestana=logistica&desglose=${code}`);
   await link(tab.playwright.locator(`#${code}-${fixture.summaryEntries[0]}`).getByRole('link',{name:person(1),exact:true}));
  }),
  logisticsAfterRemoval:(code='transporte')=>note(`missing ${code} origin restores the next available row`,async()=>{
   await back('Volver a logística de la salida');await focused(person(2));
   check(await tab.playwright.locator(`#${code}-${fixture.summaryEntries[0]}`).count()===0,'Transport origin still present');
   await link(tab.playwright.locator(`#${code}-${fixture.summaryEntries[1]}`).getByRole('link',{name:person(2),exact:true}));
  }),
  logisticsAfterEmpty:(list='transport')=>note(`empty ${list} restores its accessible fallback without changing tab or disclosure criterion`,async()=>{
   await back('Volver a logística de la salida');
   await visible(tab.playwright.locator(`[data-navigation-list-container="${list}"]:focus`));
   check(new URL(await tab.url()).searchParams.get('pestana')==='logistica','Empty logistics lost tab');
  }),
  summarySave:()=>note('Summary saves preserve criteria and neighbors; errors keep modal and focus',async()=>{
   await viewport.set({width:390,height:844});await go('/coordinacion?unidad=Voluntariado%20General&dias=14&pestana=revision');
   const source=tab.playwright.locator(`#summary-review-${fixture.summaryEntries[2]}`);
   await source.getByRole('button',{name:`Gestionar inscripción de ${person(3)}`,exact:true}).click();await tab.playwright.getByRole('button',{name:'Cancelar inscripción',exact:true}).click();await tab.playwright.getByRole('button',{name:'Cancelar inscripción',exact:true}).click();
   await visible(tab.playwright.getByRole('textbox',{name:'Motivo',exact:true}).and(tab.playwright.locator(':focus')));
   await tab.playwright.getByRole('textbox',{name:'Motivo',exact:true}).fill('Cancelación ficticia del contexto de Resumen');await tab.playwright.getByRole('button',{name:'Cancelar inscripción',exact:true}).click();
   await visible(tab.playwright.locator('[data-navigation-list="summary-attention"] a:focus'));
   check(await source.count()===0,'Saved review did not disappear');const result=new URL(await tab.url());check(result.searchParams.get('dias')==='14'&&result.searchParams.get('pestana')==='revision','Summary save lost selection');await viewport.reset();
  }),
  logisticsHistory:()=>note('logistics native Back/Forward, direct entry and independent-tab fallback',async()=>{
   await go(`/coordinacion/salidas/${fixture.summaryOuting}?pestana=logistica&desglose=alimentacion`);
   const href=await link(tab.playwright.locator(`#alimentacion-${fixture.summaryEntries[0]}`).getByRole('link',{name:person(1),exact:true}));
   const other=await createTab(base+href);try{await other.playwright.domSnapshot();check(await other.playwright.getByRole('link',{name:'‹ Volver a logística de la salida',exact:true}).count()===0,'Independent tab fabricated context');}finally{await other.close();}
   await tab.back();await visible(tab.playwright.locator('[data-navigation-list="food"]'));await tab.forward();await visible(tab.playwright.getByRole('link',{name:'‹ Volver a logística de la salida',exact:true}));await back('Volver a logística de la salida');await focused(person(1));
   await go(`/coordinacion/registro/${fixture.people[0]}`);check(await tab.playwright.getByRole('link',{name:/‹ Volver a/}).count()===0,'Direct profile fabricated context');
  }),
  beforeShrink:()=>note('pagination preserves search/unit and records page-two origin',async()=>{
   await go('/coordinacion/registro?buscar=Navegacion&unidad=Voluntariado%20General&pagina=2');
   await link(tab.playwright.getByRole('link',{name:'Anterior',exact:true}),false,false);await link(tab.playwright.getByRole('link',{name:'Siguiente',exact:true}),false,false);
   await link(tab.playwright.getByRole('link',{name:person(28),exact:true}));await visible(tab.playwright.getByRole('link',{name:'‹ Volver a voluntariado',exact:true}));
  }),
  afterShrink:()=>note('empty last page clamps URL and visibly focuses last surviving record',async()=>{
   await link(tab.playwright.getByRole('link',{name:'‹ Volver a voluntariado',exact:true}),false,false,base+'/coordinacion/registro?buscar=Navegacion&unidad=Voluntariado+General&pagina=1');await focused(person(25));
  }),
 };
}
