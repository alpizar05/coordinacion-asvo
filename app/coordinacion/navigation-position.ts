import {chooseNavigationAnchor,navigationDestination,preserveNavigationUrl,type NavigationFrame} from '../../lib/navigation-context';
const visible=(node:Element)=>!!node.getClientRects().length;
const items=(list:Element)=>Array.from(list.querySelectorAll<HTMLElement>('tbody tr[id], [data-navigation-item][id]')).filter(visible);
const listFor=(name:string)=>document.querySelector<HTMLElement>(`[data-navigation-list="${name}"]`);
export function captureNavigationPosition(anchor?:string,origin?:Element|null):NavigationFrame|null {
  const destination=navigationDestination(location.pathname+location.search);if(!destination)return null;
  const lists=Array.from(document.querySelectorAll<HTMLElement>('[data-navigation-list]'));
  const rows=lists.flatMap(items);
  const row=(anchor?document.getElementById(anchor):origin?.closest<HTMLElement>('tr[id], [data-navigation-item][id]'));
  const selected=row??rows.find(r=>r.getBoundingClientRect().bottom>80)??rows[0];
  const list=selected?.closest<HTMLElement>('[data-navigation-list]'),siblings=list?items(list):[];
  const index=selected?siblings.indexOf(selected):-1;
  const dialog=selected?.closest<HTMLDialogElement>('dialog[data-navigation-disclosure]');
  return {destination,anchor:anchor??selected?.id??'',offset:selected?.getBoundingClientRect().top??0,y:scrollY,
    ...(list?{list:list.dataset.navigationList,index:Math.max(0,index),neighbors:[...siblings.slice(index+1,index+9),...siblings.slice(Math.max(0,index-8),index).reverse()].map(r=>r.id)}:{}),
    ...(dialog?{panelY:dialog.scrollTop}:{})};
}
/** Only a disclosure explicitly identified by the source URL may receive restored focus. */
export function navigationDialogState(frame:NavigationFrame){
  const dialogs=Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
  const expected=new URL(frame.destination,'https://asvo.invalid').searchParams.get('desglose');
  return {dialog:dialogs.length>0,restorableDialog:dialogs.length===1&&!!expected&&dialogs[0].dataset.navigationDisclosure===expected};
}
export function restoreNavigationPosition(frame:NavigationFrame,focus=true){
  const list=frame.list?listFor(frame.list):null,rows=list?items(list):[];
  const id=list?chooseNavigationAnchor(frame,rows.map(r=>r.id)):frame.anchor,row=id?document.getElementById(id):null;
  const container=frame.list?document.querySelector<HTMLElement>(`[data-navigation-list-container="${frame.list}"]`):null;
  const dialog=row?.closest<HTMLDialogElement>('dialog[open][data-navigation-disclosure]');
  if(dialog){window.scrollTo({top:frame.y,behavior:'instant'});dialog.scrollTo({top:frame.panelY??Math.max(0,dialog.scrollTop+row!.getBoundingClientRect().top-frame.offset),behavior:'instant'});}
  else{
    const top=row&&visible(row)?Math.max(0,scrollY+row.getBoundingClientRect().top-frame.offset)
      :list&&!rows.length?Math.max(0,scrollY+(list.closest('section')??list).getBoundingClientRect().top-96):container?Math.max(0,scrollY+container.getBoundingClientRect().top-96):frame.y;
    window.scrollTo({top,behavior:'instant'});
  }
  const state=navigationDialogState(frame);
  if(focus&&(!state.dialog||state.restorableDialog)){
    if(row&&visible(row))row.querySelector<HTMLElement>('a,button')?.focus({preventScroll:true});
    else{const region=list?.closest<HTMLElement>('[tabindex]')??list?.closest<HTMLElement>('section')??container;if(region){if(!region.hasAttribute('tabindex'))region.tabIndex=-1;region.focus({preventScroll:true});}}
  }
}
export function resetNavigationPosition(name?:string){
  if(document.querySelector('dialog[open]'))return false;
  const list=name?listFor(name):Array.from(document.querySelectorAll('[data-navigation-list]')).find(visible);
  const target=list?.closest('section')??list??(name?document.querySelector(`[data-navigation-list-container="${name}"]`):null);
  if(target)window.scrollTo({top:Math.max(0,scrollY+target.getBoundingClientRect().top-96),behavior:'instant'});
  return true;
}
export function navigationSaved(){window.dispatchEvent(new Event('asvo:navigation-saved'));}
export function preserveCurrentNavigation(href:string){return preserveNavigationUrl(href,location.pathname+location.search);}
