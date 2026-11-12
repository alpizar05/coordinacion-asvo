'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {createNavigationStore} from '../../lib/navigation-store';
import { navigationDialogState, captureNavigationPosition, restoreNavigationPosition, resetNavigationPosition } from './navigation-position';
import { navigationRestorationDecision, navigationResetList, preserveNavigationUrl, navigationCriteria, navigationDestination, navigationLabel, navigationTrail, validListContext, type NavigationFrame, type ListContext } from '../../lib/navigation-context';

type PendingPosition={frame:NavigationFrame;kind:'return'|'save';origin:string|null;expires:number};
const NavigationContext = createContext<{read:(id:string)=>ListContext|null;save:(id:string,value:ListContext)=>void;pending:RefObject<PendingPosition|null>}|null>(null);
export function NavigationContextProvider({subject,children}:{subject:string;children:ReactNode}) {
  const pending=useRef<PendingPosition|null>(null);
  const store=useMemo(()=>createNavigationStore(subject,()=>window.sessionStorage),[subject]);
  useEffect(()=>{store.activate();const timer=window.setInterval(()=>store.purge(),60_000);const logout=()=>store.clear();window.addEventListener('asvo:navigation-session-end',logout);return()=>{clearInterval(timer);window.removeEventListener('asvo:navigation-session-end',logout);};},[store]);
  return <NavigationContext.Provider value={{read:store.read,save:store.save,pending}}><ListPositionRestorer/>{children}</NavigationContext.Provider>;
}
/** Server refreshes publish readiness; ordinary browser history owns popstate restoration. */
export function ListPositionRestorer(){
  const context=useContext(NavigationContext),path=usePathname(),query=useSearchParams();
  const latest=useRef(context);latest.current=context;
  const correction=useRef<string|null>(null),resetList=useRef<string|undefined>(undefined);
  const previous=useRef<string|null>(null),native=useRef<string|null>(null),reset=useRef<string|null>(null),generation=useRef(0);
  const submitted=useRef<{frame:NavigationFrame;time:number}|null>(null);
  const current=()=>navigationDestination(location.pathname+location.search);
  const invalidate=(clearReset=true)=>{generation.current++;if(latest.current)latest.current.pending.current=null;submitted.current=null;if(clearReset)reset.current=null;};
  function flush(consume=true){
    const request=latest.current?.pending.current;
    if(!request)return;
    const decision=navigationRestorationDecision(request,current(),navigationDialogState(request.frame));
    if(decision==='discard'){invalidate();return;}if(decision==='wait')return;
    const ticket=++generation.current;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(ticket!==generation.current||latest.current?.pending.current!==request||navigationRestorationDecision(request,current(),navigationDialogState(request.frame))!=='restore')return;
      restoreNavigationPosition(request.frame,consume);
      if(consume&&latest.current)latest.current.pending.current=null;
    }));
  }
  useEffect(()=>{
    const corrected=(event:Event)=>{const value=(event as CustomEvent).detail;if(typeof value==='string'&&navigationDestination(value)===value)correction.current=value;};
    const ready=()=>{if(latest.current?.pending.current)flush();else if(reset.current===current()&&resetNavigationPosition(resetList.current))reset.current=null;};
    const submit=(event:Event)=>{
      const form=event.target;if(!(form instanceof HTMLFormElement))return;
      if(form.hasAttribute('data-navigation-session-end')){
        invalidate();window.dispatchEvent(new Event('asvo:navigation-session-end'));return;
      }
      if(!form.closest('.coordination-content')&&!(form.closest('dialog')&&document.querySelector('.coordination-content')))return;
      const frame=captureNavigationPosition(undefined,form);
      if(frame)submitted.current={frame,time:Date.now()};
    };
    const saved=()=>{
      const capture=submitted.current;submitted.current=null;
      if(!capture||Date.now()-capture.time>5*60_000||capture.frame.destination!==current()||!latest.current)return;
      latest.current.pending.current={frame:capture.frame,kind:'save',origin:current(),expires:Date.now()+10000};
      flush(false);
    };
    const errors=()=>invalidate();
    const click=(event:MouseEvent)=>{if((event.target as Element)?.closest?.('a[href]'))invalidate();};
    const history=()=>{invalidate();native.current=current();};
    const interact=(event:Event)=>invalidate(!(event.target instanceof Element&&event.target.closest('.table-filter-modal')));
    const keyboard=(event:KeyboardEvent)=>{if(['Tab','PageUp','PageDown','Home','End','ArrowUp','ArrowDown','Escape'].includes(event.key))interact(event);};
    const close=()=>{if(latest.current?.pending.current?.kind==='save')flush(false);else ready();};
    document.addEventListener('submit',submit,true);document.addEventListener('click',click,true);
    document.addEventListener('close',close,true);
    window.addEventListener('asvo:navigation-saved',saved);window.addEventListener('asvo:form-errors',errors);
    window.addEventListener('asvo:page-corrected',corrected);window.addEventListener('asvo:results-ready',ready);window.addEventListener('popstate',history);
    window.addEventListener('pointerdown',interact);window.addEventListener('keydown',keyboard);
    window.addEventListener('wheel',interact,{passive:true});window.addEventListener('touchstart',interact,{passive:true});
    return()=>{generation.current++;document.removeEventListener('submit',submit,true);document.removeEventListener('click',click,true);document.removeEventListener('close',close,true);window.removeEventListener('asvo:navigation-saved',saved);window.removeEventListener('asvo:form-errors',errors);window.removeEventListener('asvo:page-corrected',corrected);window.removeEventListener('asvo:results-ready',ready);window.removeEventListener('popstate',history);window.removeEventListener('pointerdown',interact);window.removeEventListener('keydown',keyboard);window.removeEventListener('wheel',interact);window.removeEventListener('touchstart',interact);};
  },[]);
  useEffect(()=>{
    const destination=navigationDestination(`${path}?${query}`),old=previous.current;
    previous.current=destination;
    if(correction.current===destination){correction.current=null;if(context?.pending.current)flush();return;}
    if(native.current===destination){native.current=null;return;}native.current=null;
    const request=context?.pending.current;
    if(request){
      if(request.frame.destination===destination){flush();return;}
      if(request.origin!==destination)invalidate();
    }
    if(old&&destination&&old.split('?')[0]===destination.split('?')[0]&&navigationCriteria(old)!==navigationCriteria(destination)){
      submitted.current=null;resetList.current=navigationResetList(old,destination);reset.current=destination;
      requestAnimationFrame(()=>{if(reset.current===current()&&resetNavigationPosition(resetList.current))reset.current=null;});
    }
  },[path,query]);
  return null;
}
/** Re-rendered server results announce when refreshed rows are available. */
export function NavigationResults({revision}:{revision:unknown}){
  const path=usePathname(),query=useSearchParams();
  useEffect(()=>{window.dispatchEvent(new Event('asvo:results-ready'));},[revision,path,query]);
  return null;
}
/** The server already clamps the page. Reflect that effective page without a second query. */
export function NavigationPageBoundary({page}:{page:number}){
  const context=useContext(NavigationContext),query=useSearchParams();
  useEffect(()=>{
    const requested=query.get('pagina');
    if(requested===null||requested===String(page))return;
    const url=new URL(location.href),before=navigationDestination(url.pathname+url.search);
    url.searchParams.set('pagina',String(page));
    const request=context?.pending.current;
    if(request?.frame.destination===before){request.frame.destination=navigationDestination(url.pathname+url.search)!;if(Number(requested)>page)request.frame.index=Number.MAX_SAFE_INTEGER;}
    window.dispatchEvent(new CustomEvent('asvo:page-corrected',{detail:navigationDestination(url.pathname+url.search)}));
    window.history.replaceState(null,'',url.href);
  },[page,query]);
  return null;
}
export function ContextDetailLink({href,anchor,children,className}:{href:string;anchor:string;children:ReactNode;className?:string}){
  const context=useContext(NavigationContext),path=usePathname(),query=useSearchParams();
  const [id,setId]=useState('');useEffect(()=>setId(crypto.randomUUID()),[]);
  const destination=navigationDestination(`${path}?${query}`),target=new URL(preserveNavigationUrl(href,`${path}?${query}`),'https://asvo.invalid');
  if(id&&context&&destination&&navigationDestination(target.pathname+target.search))target.searchParams.set('navContext',id);
  return <Link className={className} href={target.pathname+target.search+target.hash} onNavigate={()=>{
    if(!context||!id||!destination)return;
    const previous=context.read(query.get('navContext')??'');
    const source=captureNavigationPosition(anchor)??{destination,anchor,offset:0,y:window.scrollY};
    const frames=navigationTrail(previous?.detail===path?previous.frames:[],source,target.pathname);
    context.save(id,{detail:target.pathname,frames,time:Date.now()});
  }}>{children}</Link>;
}
export function ContextReturnLink(){
  const context=useContext(NavigationContext),path=usePathname(),query=useSearchParams();
  const [loaded,setLoaded]=useState<{id:string;value:ListContext|null}>({id:'',value:null}),[returnId,setReturnId]=useState('');
  const id=query.get('navContext')??'';
  useEffect(()=>{const entry=context?.read(id);setLoaded({id,value:entry?.detail===path?entry:null});setReturnId(crypto.randomUUID());},[id,path]);
  const value=loaded.id===id?loaded.value:null;
  if(!value||!context||value.detail!==path)return null;
  const source=value.frames[value.frames.length-1],parents=value.frames.slice(0,-1),target=new URL(source.destination,'https://asvo.invalid');
  if(parents.length)target.searchParams.set('navContext',returnId);
  return <p><Link href={target.pathname+target.search} scroll={false} onNavigate={()=>{
    const fresh=context.read(id);if(!fresh||fresh.detail!==path)return;
    if(parents.length)context.save(returnId,{detail:target.pathname,frames:parents,time:Date.now()});
    context.pending.current={frame:source,kind:'return',origin:navigationDestination(location.pathname+location.search),expires:Date.now()+10000};
  }}>‹ {source.anchor.startsWith('serie-')?'Volver a convocatorias en serie':navigationLabel(source.destination)}</Link></p>;
}
/** URL-backed criteria for tables that filter their already-loaded rows locally. */
export function useTableCriteria(){
  const params=useSearchParams();
  return {get:(name:string,fallback='')=>params.get(name)??fallback,set:(values:Record<string,string>)=>{
    const url=new URL(window.location.href);
    for(const [key,value]of Object.entries(values))url.searchParams.set(key,value);
    window.history.replaceState(null,'',url.href);
  }};
}

/** Same-detail transitions (editing/discarding) keep the existing trail instead of nesting it. */
export function ContextStateLink({href,children,className}:{href:string;children:ReactNode;className?:string}){
  const path=usePathname(),query=useSearchParams();
  return <Link className={className} href={preserveNavigationUrl(href,`${path}?${query}`)}>{children}</Link>;
}
export function useMutationDestination(){
  const context=useContext(NavigationContext),path=usePathname(),query=useSearchParams();
  return (href:string,returnToOrigin=false)=>{
    const entry=context?.read(query.get('navContext')??'');
    if(!returnToOrigin||!context||entry?.detail!==path)return preserveNavigationUrl(href,`${path}?${query}`);
    const source=entry.frames[entry.frames.length-1],parents=entry.frames.slice(0,-1),url=new URL(source.destination,'https://asvo.invalid');
    if(parents.length){const id=crypto.randomUUID();context.save(id,{detail:url.pathname,frames:parents,time:Date.now()});url.searchParams.set('navContext',id);}
    context.pending.current={frame:source,kind:'return',origin:navigationDestination(`${path}?${query}`),expires:Date.now()+10000};
    return url.pathname+url.search;
  };
}
