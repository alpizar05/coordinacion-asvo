'use client';
import {preserveCurrentNavigation} from '../../../navigation-position';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {SectionWorkspace,type WorkspaceSection} from '../../../section-workspace';
import {saveAutomaticCollection} from '../../../../actions/series';
import {validateCommonSeries} from '../../../../../lib/outing-form-validation';
import {FormFeedbackProvider,FormErrorSummary,FormFeedbackBindings,useFormFeedback} from '../../../../form-feedback/form-feedback';
export function AutomaticCollectionEditor({id,hidden,sections,initialError}:{id:string;hidden:ReactNode;sections:WorkspaceSection[];initialError?:string}){
 const[active,setActive]=useState(sections[0].key),[pending,setPending]=useState(false);const form=useRef<HTMLFormElement>(null),busy=useRef(false),router=useRouter();
 const feedback=useFormFeedback({form,validate:validateCommonSeries,labels:{apply:'Alcance de los cambios'},revealField:name=>setActive(name==='confirm'?'review':name==='photoSource'?'photos':['requirements','logistics','plan'].includes(name)?'information':['organization','contact','area','activity'].includes(name)?'support':'general')});
 useEffect(()=>{if(initialError)feedback.showErrors({},initialError);},[initialError]);
 return <FormFeedbackProvider feedback={feedback}><form ref={form} id="datos-comunes" noValidate onChange={e=>{const t=e.target;if(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||t instanceof HTMLSelectElement)feedback.changed(t.name);}} onSubmit={async e=>{
  e.preventDefault();if(busy.current)return;const data=new FormData(e.currentTarget),errors=validateCommonSeries(data);if(Object.keys(errors).length){feedback.showErrors(errors);return;}busy.current=true;setPending(true);
  try{const result=await saveAutomaticCollection(id,data);if(result.saved){router.replace(preserveCurrentNavigation(`/coordinacion/colecciones/automaticas/${id}?guardado=1`));router.refresh();}else feedback.showErrors(result.fieldErrors,result.error);}
  catch{feedback.showErrors({},'No se pudo guardar. Los datos y el alcance seleccionado se conservan para reintentar.');}finally{busy.current=false;setPending(false);}
 }}><FormErrorSummary/><FormFeedbackBindings form={form}/>{hidden}<SectionWorkspace title="Editar datos comunes" notice={pending?'Guardando…':'Los campos seleccionados se aplican a los bloques que los heredan'} active={active} onSelect={setActive} discardHref={`/coordinacion/colecciones/automaticas/${id}`} trackChanges pending={pending} toolbar={<button type="submit" disabled={pending} className="coord-button-primary">{pending?'Guardando…':'Guardar cambios'}</button>} sections={sections.map(s=>({...s,content:<fieldset className="section-workspace-fields" disabled={pending}>{s.content}</fieldset>}))}/></form></FormFeedbackProvider>;
}
