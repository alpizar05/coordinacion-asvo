'use client';
import { useRef,useState,type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SectionWorkspace,type WorkspaceSection } from '../../../section-workspace';
import { saveAutomaticCollection } from '../../../../staff-actions';
export function AutomaticCollectionEditor({id,hidden,sections,initialError}:{id:string;hidden:ReactNode;sections:WorkspaceSection[];initialError?:string}){
 const [active,setActive]=useState(initialError?'review':sections[0].key),[error,setError]=useState(initialError||''),[pending,setPending]=useState(false);
 const errorRef=useRef<HTMLParagraphElement>(null),router=useRouter();
 return <form id="datos-comunes" noValidate onSubmit={async e=>{
  e.preventDefault();if(pending)return;const data=new FormData(e.currentTarget);setPending(true);setError('');
  try{const result=await saveAutomaticCollection(id,data);if(result.saved){router.replace(`/coordinacion/colecciones/automaticas/${id}?guardado=1`);router.refresh();}else{setError(result.error||'No se pudo guardar.');setActive('review');requestAnimationFrame(()=>errorRef.current?.focus());}}
  catch{setError('No se pudo guardar. Los datos se conservan para reintentar.');setActive('review');}finally{setPending(false);}
 }}>
  {hidden}<SectionWorkspace title="Editar datos comunes" notice={pending?'Guardando…':'Los campos seleccionados se aplican a los bloques que los heredan'} active={active} onSelect={setActive} discardHref={`/coordinacion/colecciones/automaticas/${id}`} trackChanges pending={pending}
   toolbar={<button type="submit" disabled={pending} className="coord-button-primary">{pending?'Guardando…':'Guardar cambios'}</button>}
   sections={sections.map(section=>({...section,content:<fieldset className="section-workspace-fields" disabled={pending}>{section.key==='review'&&error&&<p ref={errorRef} role="alert" className="note" tabIndex={-1}>{error}</p>}{section.content}</fieldset>}))}/>
 </form>;
}
