'use client';
import { useId,useState,type ReactNode } from 'react';
import { StatusRibbon } from '../../status-ribbon';
import { applyImportRows,applyPolicyRows,importPreview,previewPolicies } from '../../staff-actions';
import { SectionWorkspace } from '../section-workspace';
type Row={key:string;formKey?:string;label:string;detail?:string;valid:boolean;checked:boolean};
function ImportWizard({title,label,help,preview,apply}:{title:string;label:string;help:ReactNode;preview:(text:string)=>Promise<Row[]>;apply:(form:FormData)=>Promise<{applied:boolean}>}){
 const [csv,setCsv]=useState(''),[rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState<string[]>([]),[step,setStep]=useState('load'),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const fileId=useId();
 const [applying,setApplying]=useState(false),[saved,setSaved]=useState(''),[fileVersion,setFileVersion]=useState(0);
 return <form onSubmit={async event=>{
  event.preventDefault();if(applying||!selected.length)return;const form=new FormData(event.currentTarget);setApplying(true);setError('');
  try{const result=await apply(form);if(result.applied){setRows([]);setSelected([]);setCsv('');setStep('load');setFileVersion(v=>v+1);setSaved('Importación aplicada. Podés cargar un nuevo archivo.');}}
  catch{setError('No se pudo aplicar la importación. La selección se conserva para reintentar.');setStep('apply');}finally{setApplying(false);}
 }}><StatusRibbon message={saved} onExpire={setSaved}/><input name="csv" type="hidden" value={csv}/>{selected.map(key=><input key={key} name={`usar-${rows.find(r=>r.key===key)?.formKey??key}`} type="hidden" value="on"/>)}
  <SectionWorkspace compact pending={applying} title={title} active={step} onSelect={setStep} notice={applying?'Aplicando…':loading?'Revisando archivo…':`${selected.length} ${selected.length===1?'fila seleccionada':'filas seleccionadas'}`}
   toolbar={<button type="submit" className="coord-button-primary" disabled={step!=='apply'||!selected.length||loading||applying}>{applying?'Aplicando…':'Aplicar selección'}</button>}
   sections={[
    {key:'load',label:'1. Cargar archivo',content:<section className="card"><h2>Cargar archivo</h2><label htmlFor={fileId}>{label}</label><input key={fileVersion} id={fileId} type="file" accept=".csv,text/csv" disabled={loading||applying} onChange={async event=>{
      const file=event.target.files?.[0];setRows([]);setSelected([]);setCsv('');setError('');if(!file)return;
      if(file.size>150000){setError('El archivo es demasiado grande.');return;}
      setLoading(true);try{const contents=await file.text(),result=await preview(contents);setCsv(contents);setRows(result);setSelected(result.filter(r=>r.checked&&r.valid).map(r=>r.key));if(result.length)setStep('review');else setError('El archivo no contiene filas para revisar.');}
      catch{setError('No se pudo leer el CSV. Revisá los encabezados y el formato.');}finally{setLoading(false);}
    }}/>{help}<p className="muted">Cargar y revisar no modifica el registro. Solo se aplicarán las filas seleccionadas al confirmar.</p>{error&&<p role="alert" className="note">{error}</p>}{!!rows.length&&<button type="button" onClick={()=>setStep('review')}>Revisar filas</button>}</section>},
    {key:'review',label:'2. Revisar filas',content:<section className="card"><h2>Revisar filas</h2>{rows.length?<><p role="status">{selected.length} de {rows.length} {rows.length===1?'fila seleccionada':'filas seleccionadas'}</p><div className="section-workspace-review">{rows.map(row=><div key={row.key}>{row.valid?<label><input type="checkbox" disabled={applying} checked={selected.includes(row.key)} onChange={e=>setSelected(keys=>e.target.checked?[...keys,row.key]:keys.filter(k=>k!==row.key))}/>{row.label}</label>:<p>{row.label}</p>}{row.detail&&<p className="muted">{row.detail}</p>}</div>)}</div><button type="button" disabled={!selected.length} onClick={()=>setStep('apply')}>Continuar a confirmación</button></>:<p>Cargá un archivo para ver la revisión.</p>}</section>},
    {key:'apply',label:'3. Confirmar aplicación',content:<section className="card"><h2>Confirmar aplicación</h2>{error&&<p className="note" role="alert">{error}</p>}<p><strong>{selected.length}</strong> {selected.length===1?'fila se aplicará al registro.':'filas se aplicarán al registro.'}</p><p>{rows.filter(r=>!r.valid).length} filas incompletas o sin coincidencia quedarán fuera.</p>{selected.length>0?<><ul>{rows.filter(r=>selected.includes(r.key)).map(row=><li key={row.key}>{row.label}</li>)}</ul><p className="muted">Revisá la selección antes de pulsar Aplicar selección. Las filas sin seleccionar no se modificarán.</p></>:<p>Primero cargá y seleccioná filas válidas.</p>}</section>},
   ]}/>
 </form>;
}
export function Importer(){return <ImportWizard title="Importar registro de voluntariado" label="Archivo CSV" help={<p>Encabezados <code>identificacion,nombre,primer_apellido,correo</code></p>} apply={applyImportRows} preview={async text=>(await importPreview(text)).map((r,i)=>({key:`${i}-${r.id}`,formKey:r.id,label:`${r.state} · ${r.id} · ${r.name} ${r.surname} · ${r.email||'Correo pendiente'}`,valid:['Alta','Coincidencia'].includes(r.state),checked:r.state==='Alta',detail:r.current?`En el registro: ${r.current.name} ${r.current.surname} · ${r.current.email||'Correo pendiente'}`:undefined}))}/>;}
export function PolicyImporter(){return <ImportWizard title="Conciliar pólizas" label="Hoja de pólizas exportada como CSV" help={<p>Encabezados <code>identificacion,tipo,numero</code>. La vigencia se comprueba por separado.</p>} apply={applyPolicyRows} preview={async text=>(await previewPolicies(text)).map((r,i)=>({key:String(i),label:r.valid?`${r.identification} · ${r.person?.name} ${r.person?.surname} · ${r.kind} ${r.number} · Vigencia pendiente`:`${r.identification||'Identificación pendiente'} · ${r.person?'Datos de póliza incompletos':'Sin coincidencia en el registro'}`,valid:r.valid,checked:r.valid}))}/>;}
