'use client';
import { useActionState,useEffect,useRef,useState } from 'react';
import { labourOptions,activityOptions } from '../../../../lib/outing-report-options';
import { submitReport } from './actions';
import type { ReportValues } from '../../../../lib/outing-report';
import { SectionWorkspace } from '../../../coordinacion/section-workspace';
export function ReportForm({token,initial,lead,participants,selected=[]}:{token:string;initial:ReportValues;lead:{name:string;email:string};participants:{id:string;name:string}[];selected?:string[]}){
 const [values,setValues]=useState(initial),[attended,setAttended]=useState(selected),[accuracy,setAccuracy]=useState(false),[active,setActive]=useState('data');
 const [state,action,pending]=useActionState(submitReport.bind(null,token),{});
 const form=useRef<HTMLFormElement>(null),errorRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{
  if(!state.errors)return;
  const first=Object.keys(state.errors)[0];
  setActive(['labour','activity','actions'].includes(first)?'work':first==='participants'?'attendance':first==='observations'?'observations':['email','location','starts','ends','host'].includes(first)?'data':'review');
  requestAnimationFrame(()=>{const field=Array.from(form.current?.querySelectorAll<HTMLElement>('[aria-invalid=true]')||[]).find(el=>!el.closest('[hidden]'));if(field)field.focus();else errorRef.current?.focus();});
 },[state]);
 const fields:{name:Exclude<keyof ReportValues,'labour'|'activity'>;label:string;multiline?:boolean;max?:number;optional?:boolean;type?:string}[]=[
  {name:'location',label:'Área silvestre protegida o lugar visitado'},
  {name:'starts',label:'Fecha de inicio real',type:'date'},{name:'ends',label:'Fecha de finalización real',type:'date'},
  {name:'host',label:'Persona funcionaria del SINAC a cargo o responsable de la actividad'},
  {name:'actions',label:'Acciones realizadas',multiline:true,max:10000},
  {name:'observations',label:'Observaciones o recomendaciones',multiline:true,max:5000,optional:true},
 ];
 const renderField=(name:typeof fields[number]['name'])=>{const item=fields.find(f=>f.name===name)!;return <label key={name} className={name==='location'||name==='host'?'report-field-wide':undefined}>{item.label}{item.optional?' (opcional)':''}
  {item.multiline?<textarea name={name} value={values[name]} maxLength={item.max} required={!item.optional} aria-invalid={!!state.errors?.[name]} aria-describedby={`report-help-${name}`} onChange={e=>setValues(v=>({...v,[name]:e.target.value}))}/>
   :<input name={name} type={item.type||'text'} value={values[name]} maxLength={item.type?undefined:500} required={!item.optional} aria-invalid={!!state.errors?.[name]} aria-describedby={`report-help-${name}`} onChange={e=>setValues(v=>({...v,[name]:e.target.value}))}/>}
  <span id={`report-help-${name}`} className={state.errors?.[name]?'report-error':'muted'}>{state.errors?.[name]||(item.type?'Revisá las fechas reales de participación.':'')}</span></label>;};
 return <form ref={form} action={action} noValidate className="outing-report-form">
  {participants.map(p=><input key={p.id} name="roster" type="hidden" value={p.id}/>)}
  <SectionWorkspace compactDiscard title="Informe de salida" active={active} onSelect={setActive} trackChanges pending={pending} notice={pending?'Guardando…':'Guardá un borrador o finalizá el informe'}
   toolbar={<><button type="submit" name="intent" value="borrador" formNoValidate disabled={pending||!lead.email}>Guardar borrador</button><button type="submit" name="intent" value="finalizar" className="workspace-primary" disabled={pending||!lead.email||!participants.length}>Finalizar informe</button></>}
   sections={[
    {key:'data',label:'Datos de la gira',content:<section className="card"><h2>Datos de la gira</h2><h3>Persona responsable (70)</h3><p><strong>{lead.name}</strong><br/>{lead.email||'Correo pendiente de registrar'}</p><p className="muted">Los datos del 70 provienen de su ficha. Revisá los datos precargados de la gira.</p>{state.errors?.email&&<p role="alert" className="note">{state.errors.email}</p>}<fieldset disabled={pending} className="section-workspace-fields"><div className="report-fields">{['location','starts','ends','host'].map(name=>renderField(name as typeof fields[number]['name']))}</div></fieldset></section>},
    {key:'work',label:'Labores y acciones',content:<section className="card"><h2>Labores y acciones</h2><fieldset disabled={pending} className="section-workspace-fields"><fieldset tabIndex={-1} aria-invalid={!!state.errors?.labour} aria-describedby="report-help-labour"><legend>Tipo de labor realizada</legend>{labourOptions.map(option=><label key={option}><input type="checkbox" name="labour" value={option} checked={values.labour.includes(option)} onChange={e=>setValues(v=>({...v,labour:e.target.checked?[...v.labour,option]:v.labour.filter(x=>x!==option)}))}/>{option}</label>)}<p id="report-help-labour" className={state.errors?.labour?'report-error':'muted'}>{state.errors?.labour||'Podés seleccionar varias opciones.'}</p></fieldset>
     <label>Tipo de gira según la actividad realizada<select name="activity" value={values.activity} aria-invalid={!!state.errors?.activity} onChange={e=>setValues(v=>({...v,activity:e.target.value}))}><option value="">Seleccioná una opción</option>{activityOptions.map(option=><option key={option}>{option}</option>)}</select>{state.errors?.activity&&<span className="report-error">{state.errors.activity}</span>}</label>{renderField('actions')}</fieldset></section>},
    {key:'attendance',label:'Asistencia',content:<section className="card"><h2>Participación real del equipo</h2><p>Marcá únicamente a quienes participaron realmente. Al finalizar, las personas sin marcar quedarán registradas como no participantes. El borrador no confirma asistencia.</p><p role="status"><strong>{attended.length} de {participants.length}</strong> personas seleccionadas provisionalmente.</p><fieldset disabled={pending} aria-invalid={!!state.errors?.participants} tabIndex={-1}><legend>Confirmación de asistencia</legend>{participants.map(p=><label key={p.id}><input name="attended" type="checkbox" value={p.id} checked={attended.includes(p.id)} onChange={e=>setAttended(v=>e.target.checked?[...v,p.id]:v.filter(id=>id!==p.id))}/>{p.name}</label>)}</fieldset>{!participants.length&&<p>No hay inscripciones confirmadas. Contactá a Coordinación.</p>}{state.errors?.participants&&<p className="report-error" role="alert">{state.errors.participants}</p>}<p className="muted">Si falta una persona que participó, contactá a Coordinación para conciliar su inscripción antes de finalizar.</p></section>},
    {key:'observations',label:'Observaciones',content:<section className="card"><h2>Observaciones y recomendaciones</h2><fieldset disabled={pending} className="section-workspace-fields">{renderField('observations')}</fieldset></section>},
    {key:'review',label:'Revisión final',content:<section className="card"><h2>Revisión del informe</h2><dl className="profile-facts"><div><dt>Lugar</dt><dd>{values.location||'Pendiente'}</dd></div><div><dt>Fechas reales</dt><dd>{values.starts||'Pendiente'} — {values.ends||'Pendiente'}</dd></div><div><dt>Labores</dt><dd>{values.labour.join(', ')||'Pendiente'}</dd></div><div><dt>Asistencia</dt><dd>{attended.length} de {participants.length} personas</dd></div></dl><label><input name="accuracy" type="checkbox" checked={accuracy} disabled={pending} required aria-invalid={!!state.errors?.accuracy} onChange={e=>setAccuracy(e.target.checked)}/>Confirmo que revisé la asistencia y que este informe refleja lo realizado.</label>{state.errors?.accuracy&&<p role="alert" className="report-error">{state.errors.accuracy}</p>}{state.errors?.form&&<p ref={errorRef} className="note" role="alert" tabIndex={-1}>{state.errors.form}</p>}<p className="muted">Guardar borrador permite continuar después y mantiene la tarea pendiente. Finalizar guarda el informe definitivo y bloquea la edición.</p></section>},
   ]}/>
 </form>;
}
