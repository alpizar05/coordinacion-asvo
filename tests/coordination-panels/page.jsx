'use client';
import {useEffect,useState,useRef} from 'react';
import {VolunteerUnits} from '../coordinacion/registro/volunteer-units';
import {ReportReminder} from '../coordinacion/report-reminder';
import {ActionModal} from '../coordinacion/action-modal';
import {RegistryModal} from '../coordinacion/registry-form';
import {RowActionPanel} from '../coordinacion/row-action-panel';
import {RegistrationActions} from '../coordinacion/registration-actions';
import {CollectionsTable} from '../coordinacion/collections-table';
import {TableFilters} from '../coordinacion/table-filters';
import {MobileDisclosure} from '../coordinacion/mobile-disclosure';
import {SummaryViewSelector} from '../coordinacion/summary-view-selector';
import {FormField} from '../form-feedback/form-feedback';
import {NavigationContextProvider} from '../coordinacion/navigation-context';
import {ConfirmationProvider} from '../status-ribbon';
import '../coordinacion/coordination.css';
const entry={id:'11111111-1111-4111-8111-000000000001',version:'1',status:'confirmada',identification:'102340567',starts:'2035-01-10',ends:'2035-01-12'};
export default function Page(){const hidden=useRef(null);const[ready,setReady]=useState(false),[mode,setMode]=useState('error'),[calls,setCalls]=useState(0);useEffect(()=>setReady(true),[]);
async function action(){setCalls(n=>n+1);if(mode==='delay')await new Promise(r=>setTimeout(r,4000));if(mode==='throw')throw Error('Fallo ficticio');return mode==='success'?{saved:true}:{error:'Error general ficticio.',fieldErrors:{detail:['Revisá el detalle.'],extra:['Revisá el campo final.']}};}
return <ConfirmationProvider><NavigationContextProvider subject="fictitious-panels"><div className="coordination-content" data-panels-ready={ready?'yes':'no'}><h1>Revisión local de paneles</h1><label>Respuesta simulada<select value={mode} onChange={e=>setMode(e.target.value)}>{['error','delay','success','throw'].map(v=><option key={v}>{v}</option>)}</select></label><output aria-label="Invocaciones">{calls}</output>
<section className="card" aria-label="Inscripción"><h2>Acciones reales de inscripción</h2><RegistrationActions entry={entry} outing={{flexible:false,first_day:entry.starts,last_day:entry.ends}} personName="Persona Ficticia"/></section>
<section className="card" aria-label="Series"><h2>Series reales</h2><CollectionsTable collections={[{id:'11111111-1111-4111-8111-000000000002',name:'Serie Ficticia',kind:'automaticas',outings:2,public_outings:2,next_start:entry.starts}]}/></section>
<section className="card" aria-label="Formulario"><ActionModal title="Formulario de revisión" action={action} revealField={name=>{if(name==='extra'&&hidden.current)hidden.current.open=true;}} validate={()=>({})}><FormField name="detail" label="Detalle"><input name="detail" defaultValue="Dato conservado"/></FormField><label>Archivo ficticio<input type="file" name="attachment"/></label>{Array.from({length:10},(_,i)=><label key={i}>Dato {i}<input defaultValue="Sin datos reales"/></label>)}<details ref={hidden}><summary>Campo oculto</summary><FormField name="extra" label="Campo final"><input name="extra" defaultValue="Conservado"/></FormField></details></ActionModal></section>
<section className="card" aria-label="Registro"><VolunteerUnits volunteerId={entry.id} units={['Voluntariado General','UEA']} selected={[]}/><RegistryModal title="Verificar póliza ficticia" kind="policy" action={action}>{['kind','number','source','starts','ends'].map(name=><FormField key={name} name={name} label={name}><input name={name} type={name==='starts'||name==='ends'?'date':'text'}/></FormField>)}</RegistryModal><ReportReminder outingId={entry.id} registrationId={entry.id} name="Persona Ficticia" email="persona@example.test" title="Salida ficticia" starts="10/01/2035" ends="12/01/2035" activeLink demo/></section>
<section className="card" aria-label="Filtros"><TableFilters title="Filtros de prueba"><label>Estado<select defaultValue="revision"><option value="revision">Revisión</option><option>Todos</option></select></label></TableFilters><MobileDisclosure title="Transporte ficticio"><p>Desglose sin datos reales.</p><button type="button">Consultar transporte</button></MobileDisclosure></section>
<section className="card" aria-label="Vistas"><SummaryViewSelector selected="revision" options={[{key:'revision',label:'Inscripciones en revisión',count:2,href:'?vista=revision'},{key:'informes',label:'Informes pendientes',count:1,href:'?vista=informes'}]}/></section>
<RowActionPanel title="Panel de referencia">{close=><ul className="registration-sheet-actions"><li><button onClick={close}>Cerrar referencia</button></li></ul>}</RowActionPanel>
</div><section className="card" aria-label="Público"><button type="submit">Acción pública</button></section></NavigationContextProvider></ConfirmationProvider>;}
