'use client';
import {registrationLimits} from '../../lib/registration-validation';
import { FormField } from '../form-feedback/form-feedback';
export function StaffParticipationFields({starts,ends,flexible,general,transport,onTransport,seats=0,food='',other='',interested70=false,legacySeats=false}:{starts:string;ends:string;flexible:boolean;general:boolean;transport:boolean;onTransport:(value:boolean)=>void;seats?:number;food?:string;other?:string;interested70?:boolean;legacySeats?:boolean}){
 return <>
  <div className="form-grid"><FormField name="starts" label="Llegada"><input name="starts" type="date" required defaultValue={starts} readOnly={!flexible}/></FormField>
  <FormField name="ends" label="Regreso"><input name="ends" type="date" required defaultValue={ends} readOnly={!flexible}/></FormField></div>
  <FormField name="transport" label="Tiene transporte propio"><input type="checkbox" name="transport" checked={transport} onChange={event=>onTransport(event.target.checked)}/></FormField>
  <div hidden={!transport}><FormField name="rides" label="Personas que puede llevar"><input name="rides" type="number" min="0" max={registrationLimits.rides} required defaultValue={seats} disabled={!transport}/></FormField></div>
  {legacySeats&&<p className="muted">La inscripción anterior ofrecía transporte sin indicar cantidad. Revisá cuántas personas puede llevar.</p>}
  <FormField name="food" label="Restricciones alimentarias"><textarea name="food" maxLength={registrationLimits.detail} defaultValue={food}/></FormField>
  {general&&<label><input name="lead" type="checkbox" defaultChecked={interested70}/> Tiene interés en ser 70</label>}
  <FormField name="other" label="Otras observaciones"><textarea name="other" maxLength={registrationLimits.detail} defaultValue={other}/></FormField>
 </>;
}
