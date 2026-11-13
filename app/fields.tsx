'use client';

import { useEffect,useRef,useState } from 'react';
import {registrationLimits} from '../lib/registration-validation';
import { FormField } from './form-feedback/form-feedback';

export function RegistrationFields({flexible,general,starts,ends,details={},arrival,departure}: {
  flexible:boolean;general:boolean;starts:string;ends:string;details?:Record<string,string|boolean|number>;arrival?:string;departure?:string;
}){
  const transport=useRef<HTMLInputElement>(null);
  const [hasTransport,setHasTransport]=useState(!!details.transporte);
  useEffect(()=>{const input=transport.current;const update=()=>setHasTransport(!!input?.checked);input?.addEventListener('change',update);return()=>input?.removeEventListener('change',update);},[]);
  return <>{flexible&&<div className="grid">
    <FormField name="starts" label="Llegada"><input type="date" name="starts" defaultValue={arrival??starts} required /></FormField>
    <FormField name="ends" label="Regreso"><input type="date" name="ends" defaultValue={departure??ends} required /></FormField>
  </div>}
  <FormField name="transport" label="Tengo transporte propio"><input type="checkbox" name="transport" ref={transport} defaultChecked={!!details.transporte} onChange={event=>setHasTransport(event.target.checked)}/></FormField>
  <div hidden={!hasTransport}><FormField name="rides" label="Personas que puedo llevar"><input disabled={!hasTransport} type="number" name="rides" min={0} max={registrationLimits.rides} step={1} required defaultValue={typeof details.ofreceTransporte==='number'?details.ofreceTransporte:0}/></FormField></div>
  <FormField name="food" label="Restricciones alimentarias"><textarea name="food" maxLength={registrationLimits.detail} defaultValue={String(details.alimentacion||'')}/></FormField>
  {general&&<label><input type="checkbox" name="lead" defaultChecked={!!details.interes70}/> Me interesa asumir la responsabilidad de 70</label>}
  <FormField name="other" label="Otro detalle para esta salida"><textarea name="other" maxLength={registrationLimits.detail} defaultValue={String(details.otro||'')}/></FormField>
  </>;
}
