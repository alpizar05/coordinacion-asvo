'use client';
// Only mounted in the disposable copy, on an allowed outing-detail path.
import {useEffect,useState} from 'react';
import {AddRegistration} from '../../add-registration';
import {EditRegistration} from '../../edit-registration';
import {NavigationResults} from '../../navigation-context';
export default function ReviewFixture(){
 const[ready,setReady]=useState(false),[open,setOpen]=useState(false),[saves,setSaves]=useState(0);
 useEffect(()=>{setReady(true);const saved=()=>setSaves(n=>n+1);window.addEventListener('asvo:navigation-saved',saved);return()=>window.removeEventListener('asvo:navigation-saved',saved);},[]);
 return <section className="card" data-staff-results-review={ready?'ready':'loading'}>
 <h1>Revisión ficticia de inscripciones</h1><output aria-label="Guardados confirmados">{saves}</output><NavigationResults revision={saves}/>
 <p>La respuesta del doble se selecciona con Restricciones alimentarias: fields, missing, null, array, string, empty-errors, truthy, contradictory, no-status, invalid-status, throw, delay, review y wait.</p>
 <p>Origen ficticio con filtros estado=revisión, pestaña=inscripciones.</p>
 <ol data-navigation-list="inscripciones">{Array.from({length:25},(_,index)=><li id={`inscripcion-fixture-${index}`} data-navigation-item key={index} style={{minHeight:'150px'}}>
 <h2>Fila ficticia {index}</h2>{index===12?<><AddRegistration outing={{id:'22222222-2222-4222-8222-222222222222',starts:'2035-01-10',ends:'2035-01-12',flexible:true,general:true}}/><button onClick={()=>setOpen(true)}>Abrir edición ficticia</button><EditRegistration id="33333333-3333-4333-8333-333333333333" open={open} onClose={()=>setOpen(false)}/></>:<button>Consultar fila ficticia {index}</button>}
 </li>)}</ol></section>;
}
