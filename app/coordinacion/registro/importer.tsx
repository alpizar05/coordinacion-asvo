'use client';
import {useRef,useState,type ReactNode} from 'react';
import {StatusRibbon} from '../../status-ribbon';
import {FormFeedbackProvider,FormErrorSummary,FormField,FormFieldGroup,useFormFeedback} from '../../form-feedback/form-feedback';
import {applyImportRows,applyPolicyRows,importPreview,previewPolicies} from '../../actions/volunteers';
import {SectionWorkspace} from '../section-workspace';
import type {ImportPreview,ImportRow} from '../../../lib/registry-import';
import type {FieldErrors,FormResult} from '../../../lib/form-result';
function ImportWizard({title,label,help,preview,apply}:{title:string;label:string;help:ReactNode;preview:(text:string)=>Promise<ImportPreview>;apply:(f:FormData)=>Promise<FormResult>}){
 const [csv,setCsv]=useState(''),[rows,setRows]=useState<ImportRow[]>([]),[token,setToken]=useState(''),[selected,setSelected]=useState<string[]>([]),[step,setStep]=useState('load');
 const [loading,setLoading]=useState(false),[applying,setApplying]=useState(false),[saved,setSaved]=useState({id:0,message:''}),[fileVersion,setFileVersion]=useState(0),[previewVersion,setPreviewVersion]=useState(0);
 const form=useRef<HTMLFormElement>(null),busy=useRef(false),readVersion=useRef(0);
 const validate=(f:FormData):FieldErrors=>{const errors:FieldErrors={};if(!rows.length)errors.csv='Cargá y previsualizá un CSV válido.';if(!f.getAll('selected').length)errors.selected='Seleccioná al menos una fila válida.';if(f.get('confirm')!=='on')errors.confirm='Confirmá que revisaste las filas seleccionadas.';return errors;};
 const feedback=useFormFeedback({form,validate,revealField:name=>setStep(name==='csv'?'load':name==='selected'?'review':'apply')});
 const refreshPreview=async()=>{
  if(!csv||busy.current||loading)return;setLoading(true);
  try{const result=await preview(csv);if(!result.rows||!result.token){feedback.showErrors(result.fieldErrors,result.error);return;}
   setRows(result.rows);setToken(result.token);setSelected(keys=>keys.filter(key=>result.rows!.some(row=>row.key===key&&row.valid)));setPreviewVersion(v=>v+1);feedback.reset();setStep('review');
  }catch{feedback.showErrors({},'No se pudo actualizar la previsualización. El archivo y la selección se conservan.');}finally{setLoading(false);}
 };

 return <FormFeedbackProvider feedback={feedback}><form ref={form} noValidate onChange={e=>{const t=e.target;if(t instanceof HTMLInputElement)feedback.changed(t.name);}} onSubmit={async e=>{
  e.preventDefault();if(busy.current||loading)return;
  const data=new FormData(e.currentTarget),errors=validate(data);if(Object.keys(errors).length){feedback.showErrors(errors);return;}
  data.set('csv',csv);data.set('preview',token);data.set('versions',JSON.stringify(rows.map(r=>r.version)));
  busy.current=true;setApplying(true);
  try{const result=await apply(data);if(!result.saved)feedback.showErrors(result.fieldErrors,result.error);else{setRows([]);setSelected([]);setCsv('');setToken('');setStep('load');setFileVersion(v=>v+1);feedback.reset();setSaved(p=>({id:p.id+1,message:'Importación aplicada. Podés cargar un nuevo archivo.'}));}}
  catch{feedback.showErrors({},'No se pudo aplicar la importación. El archivo y la selección se conservan para reintentar.');}
  finally{busy.current=false;setApplying(false);}
 }}><StatusRibbon key={saved.id} message={saved.message}/><FormErrorSummary/>
 <SectionWorkspace compact pending={applying||loading} title={title} active={step} onSelect={setStep} notice={applying?'Aplicando…':loading?'Revisando archivo…':`${selected.length} ${selected.length===1?'fila seleccionada':'filas seleccionadas'}`}
 toolbar={<button type="submit" className="coord-button-primary" disabled={step!=='apply'||loading||applying}>{applying?'Aplicando…':'Aplicar selección'}</button>}
 sections={[
 {key:'load',label:'1. Cargar archivo',content:<section className="card"><h2>Cargar archivo</h2><FormField name="csv" label={label}><input key={fileVersion} name="csv" type="file" accept=".csv,text/csv" disabled={loading||applying} onChange={async e=>{
  const file=e.target.files?.[0],version=++readVersion.current;setRows([]);setSelected([]);setToken('');setCsv('');feedback.reset();if(!file)return;
  if(file.size>150000){feedback.showErrors({csv:'El archivo supera el máximo de 150 KB.'});return;}
  setLoading(true);let contents:string;try{contents=await file.text();}catch{feedback.showErrors({csv:'No se pudo leer el archivo seleccionado. Volvé a elegir un CSV legible.'});setLoading(false);return;}
  try{const result=await preview(contents);if(version!==readVersion.current)return;
   if(!result.rows||!result.token){feedback.showErrors(result.fieldErrors,result.error);return;}
   setCsv(contents);setRows(result.rows);setToken(result.token);setSelected(result.rows.filter(r=>r.valid&&r.checked).map(r=>r.key));setStep('review');
  }catch{feedback.showErrors({},'No se pudo revisar el archivo. Conservá el CSV e intentá nuevamente.');}finally{if(version===readVersion.current)setLoading(false);}
 }}/></FormField>{help}<p className="muted">Cargar y revisar no escribe en el registro. Confirmá explícitamente antes de aplicar.</p>{!!rows.length&&<div className="actions"><button type="button" onClick={()=>setStep('review')}>Revisar filas</button><button type="button" disabled={loading||applying} onClick={refreshPreview}>Actualizar previsualización</button></div>}</section>},
 {key:'review',label:'2. Revisar filas',content:<section className="card"><h2>Revisar filas</h2><FormFieldGroup name="selected" label="Filas para aplicar"><div className="section-workspace-review">{rows.map(row=><div key={row.key}>
 <label><input type="checkbox" name="selected" value={row.key} disabled={!row.valid||applying||loading} checked={selected.includes(row.key)} onChange={e=>setSelected(keys=>e.target.checked?[...keys,row.key]:keys.filter(k=>k!==row.key))}/>{`Fila ${row.line} · ${row.state} · ${row.id} · ${row.name} ${row.surname} ${row.kind} ${row.number}`}</label>
 {row.issues.map((issue,i)=><p className="form-field-error" key={i}>{`Fila ${row.line}, columna ${issue.column}: ${issue.reason}`}</p>)}
 {row.current&&<p className="muted">En el registro: {row.current.name} {row.current.surname} · {row.current.email||'Correo pendiente'}</p>}
 </div>)}</div></FormFieldGroup><button type="button" disabled={applying||loading} onClick={()=>{if(!selected.length)feedback.showErrors({selected:'Seleccioná al menos una fila válida.'});else setStep('apply');}}>Continuar a confirmación</button></section>},
 {key:'apply',label:'3. Confirmar aplicación',content:<section className="card"><h2>Confirmar aplicación</h2><p>{selected.length} filas se aplicarán; {rows.filter(r=>!r.valid).length} filas inválidas quedan excluidas.</p><ul>{rows.filter(r=>selected.includes(r.key)).map(row=><li key={row.key}>Fila {row.line} · {row.id} · {row.name} {row.kind} {row.number}</li>)}</ul><FormField name="confirm" label="Revisé las filas seleccionadas y confirmo su aplicación."><input key={previewVersion+token+selected.join(',')} name="confirm" type="checkbox" disabled={applying||!rows.length}/></FormField></section>}
 ]}/></form></FormFeedbackProvider>;
}
export function Importer(){return <ImportWizard title="Importar registro de voluntariado" label="Archivo CSV" help={<p>Encabezados <code>identificacion,nombre,primer_apellido,correo</code></p>} apply={applyImportRows} preview={importPreview}/>;}
export function PolicyImporter(){return <ImportWizard title="Conciliar pólizas" label="Hoja de pólizas exportada como CSV" help={<p>Encabezados <code>identificacion,tipo,numero</code>. La vigencia se verifica por separado.</p>} apply={applyPolicyRows} preview={previewPolicies}/>;}
