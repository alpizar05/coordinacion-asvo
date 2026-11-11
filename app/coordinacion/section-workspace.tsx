'use client';
import { useEffect,useId,useState,type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CoordinationModal } from './coordination-modal';
import './section-workspace.css';
export type WorkspaceSection={key:string;label:string;content:ReactNode};
export function SectionWorkspace({sections,title,toolbar,initial,active,onSelect,discardHref,trackChanges=false,pending=false,notice,compact=false,compactDiscard=false}: {
 sections:WorkspaceSection[];compact?:boolean;compactDiscard?:boolean;title?:string;toolbar?:ReactNode;initial?:string;active?:string;onSelect?:(key:string)=>void;discardHref?:string;trackChanges?:boolean;pending?:boolean;notice?:string;
}){
 const [local,setLocal]=useState(initial||sections[0]?.key),[open,setOpen]=useState(false),[dirty,setDirty]=useState(false),[discard,setDiscard]=useState<string|null>(null);
 const current=active??local,id=useId(),router=useRouter();
 const select=(key:string)=>{if(onSelect)onSelect(key);else setLocal(key);setOpen(false);};
 useEffect(()=>{
  if(!trackChanges||!dirty)return;
  const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
  const click=(e:MouseEvent)=>{const a=(e.target as Element)?.closest?.('a');if(!pending&&a?.origin===location.origin&&a.href&&!e.ctrlKey&&!e.metaKey&&e.button===0){e.preventDefault();setDiscard(a.href);}};
  window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);};
 },[trackChanges,dirty,pending]);
 const discardButton=discardHref?<button type="button" className={compactDiscard?'workspace-discard-compact':undefined} disabled={pending} onClick={()=>dirty?setDiscard(discardHref):router.push(discardHref)}>Descartar</button>:null;
 return <div className={`section-workspace${compact?' section-workspace-compact':''}`} onChangeCapture={()=>{if(trackChanges)setDirty(true);}}>
  {(title||toolbar||discardHref)&&<div className={`section-workspace-bar${compactDiscard?' section-workspace-bar-compact-discard':''}`}><div><div className="section-workspace-bar-heading">{title&&<strong>{title}</strong>}</div>{notice&&<span role="status">{notice}</span>}</div><div className="actions">{discardButton}{toolbar}</div></div>}
  <div className="section-workspace-layout"><nav className="section-workspace-nav" aria-label="Secciones">{sections.map((s,i)=><button type="button" key={s.key} aria-current={s.key===current?'step':undefined} aria-controls={`${id}-${s.key}`} onClick={()=>select(s.key)}><span aria-hidden="true">{i+1}</span>{s.label}</button>)}</nav>
   <div className="section-workspace-content"><button type="button" className="section-workspace-trigger" aria-haspopup="dialog" onClick={()=>setOpen(true)}>Sección: {sections.find(s=>s.key===current)?.label}<span aria-hidden="true">⌄</span></button>
    {sections.map(s=><div key={s.key} id={`${id}-${s.key}`} hidden={s.key!==current} className="section-workspace-panel" role="region" aria-label={s.label}>{s.content}</div>)}
   </div>
  </div>
  <CoordinationModal open={open} onClose={()=>setOpen(false)} title="Elegir sección"><div className="editor-section-options">{sections.map(s=><button type="button" key={s.key} aria-pressed={s.key===current} onClick={()=>select(s.key)}>{s.label}</button>)}</div></CoordinationModal>
  <CoordinationModal open={!!discard} onClose={()=>setDiscard(null)} title="Descartar cambios" footer={<button type="button" className="coord-button-danger" onClick={()=>{const href=discard!;setDirty(false);setDiscard(null);router.push(href);}}>Descartar y salir</button>}><p>Hay cambios sin guardar. ¿Querés descartarlos y salir?</p></CoordinationModal>
 </div>;
}
