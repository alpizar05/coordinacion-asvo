'use client';
import {useEffect,useState} from 'react';
import {AddRegistration} from '../coordinacion/add-registration';
import {EditRegistration} from '../coordinacion/edit-registration';
import {ConfirmationProvider} from '../status-ribbon';
import '../coordinacion/coordination.css';
export default function Fixture(){
 const[ready,setReady]=useState(false),[open,setOpen]=useState(false);useEffect(()=>setReady(true),[]);
 return <ConfirmationProvider><section className="card" data-staff-results-fixture={ready?'ready':'loading'}><h1>Inscripciones ficticias</h1>
 <p>Sin base ni proveedores. Usá Restricciones alimentarias para elegir respuesta: fields, missing, truthy, contradictory, no-status, invalid-status, throw, delay, review o wait.</p>
 <AddRegistration outing={{id:'22222222-2222-4222-8222-222222222222',starts:'2035-01-10',ends:'2035-01-12',flexible:true,general:true}}/>
 <button onClick={()=>setOpen(true)}>Abrir edición ficticia</button><EditRegistration id="33333333-3333-4333-8333-333333333333" open={open} onClose={()=>setOpen(false)}/>
 </section></ConfirmationProvider>;
}
