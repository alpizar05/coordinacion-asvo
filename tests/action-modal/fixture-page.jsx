'use client';
// Test-only page copied into a temporary Next tree. Never installed in the application.
// Malformed results are intentional runtime fixtures, not production action contracts.
import {useEffect,useState} from 'react';
import {ActionModal} from '../coordinacion/action-modal';
import {RegistryModal,RegistryForm} from '../coordinacion/registry-form';
import {FormField} from '../form-feedback/form-feedback';
import {ConfirmationProvider} from '../status-ribbon';
import '../coordinacion/coordination.css';

export default function Fixture(){
 const [section,setSection]=useState('first'),[calls,setCalls]=useState(0),[open,setOpen]=useState(false);
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const select=<label>Respuesta ficticia<select name="fixtureMode" defaultValue="fields">{['fields','hidden','general','missing','legacy','truthy','contradictory','throw','saved'].map(value=><option key={value}>{value}</option>)}</select></label>;
 async function action(data){
  const mode=String(data.get('fixtureMode')||'fields');
  setCalls(n=>n+1);
  if(mode==='fields')return {fieldErrors:{first:['Primera corrección','Segunda corrección'],second:'Revisá el segundo dato'}};
  if(mode==='hidden')return {fieldErrors:{second:'Error en sección oculta'}};
  if(mode==='general')return {error:'Conflicto ficticio de versión. Tus datos se conservan.'};
  if(mode==='missing')return undefined;
  if(mode==='legacy')return 'OK';
  if(mode==='truthy')return {saved:'true'};
  if(mode==='contradictory')return {saved:true,error:'No se guardó'};
  if(mode==='throw')throw Error('Synthetic exception');
  return {saved:true};
 }
 const fields=<>{select}
  <div hidden={section!=='first'}><FormField name="first" label="Primer dato"><input name="first" defaultValue="Dato conservado"/></FormField></div>
  <div hidden={section!=='second'}><FormField name="second" label="Segundo dato"><textarea name="second" defaultValue="Segundo conservado"/></FormField></div>
  <label>Archivo preparado<input type="file" name="file"/></label>
 </>;
 return <ConfirmationProvider><section data-modal-fixture="true" data-fixture-ready={ready?'true':'false'} className="coordination-content card">
  <h1>Prueba ficticia de contratos</h1><p>Sin persistencia, correo o proveedores. Llamadas: <output>{calls}</output></p>
  <ActionModal title="Modal local" action={action} validate={()=>({})} successMessage="Guardado ficticio confirmado." revealField={name=>setSection(name==='second'?'second':'first')}>{fields}</ActionModal>
  <button onClick={()=>setOpen(true)}>Abrir controlado</button>
  <ActionModal title="Modal controlado" open={open} onClose={()=>setOpen(false)} action={action} validate={()=>({})} successMessage="Guardado controlado confirmado." revealField={name=>setSection(name==='second'?'second':'first')}>{fields}</ActionModal>
  <RegistryModal kind="attendance" title="Wrapper de asistencia" action={async data=>{setCalls(n=>n+1);return data.get('fixtureMode')==='saved'?{saved:true}:{error:'Evidencia ficticia cambió'}}}>
   {select}<FormField name="decision" label="Decisión"><select name="decision" defaultValue=""><option value="">Elegí</option><option value="participo">Participó</option></select></FormField>
   <FormField name="reason" label="Motivo"><textarea name="reason"/></FormField>
  </RegistryModal>
  <h2>Formulario inline</h2>
  <RegistryForm kind="incident" action={async data=>{setCalls(n=>n+1);return data.get('fixtureMode')==='saved'?{saved:true}:undefined}} successMessage="Incidente ficticio guardado.">
   {select}<FormField name="occurred_on" label="Fecha ficticia"><input name="occurred_on" type="date" defaultValue="2035-01-10"/></FormField>
   <FormField name="description" label="Descripción ficticia"><textarea name="description" defaultValue="Texto conservado"/></FormField><button>Guardar inline</button>
  </RegistryForm>
 </section></ConfirmationProvider>;
}
