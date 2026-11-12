import {validateRegistryForm} from './registry-validation';
import type {FormResult} from './form-result';
import {audit,field,type Transaction} from './registration';
export async function verifyRegistryPolicy(tx:Transaction,id:string,form:FormData,actor:string):Promise<FormResult>{
 const errors=validateRegistryForm(form,'policy');if(Object.keys(errors).length)return {fieldErrors:errors};
 const [person]=await tx`select id from volunteers where id=${id} for update`;if(!person)return {error:'La persona ya no está disponible.'};
 const kind=field(form,'kind'),number=field(form,'number'),starts=field(form,'starts'),ends=field(form,'ends'),source=field(form,'source');
 const [existing]=await tx`select id from policies where volunteer_id=${id} and kind=${kind} and number=${number} and starts=${starts}::date and ends=${ends}::date and source=${source} and verified_at is not null`;
 if(existing)return {saved:true};
 const [policy]=await tx`insert into policies(volunteer_id,kind,number,starts,ends,source,verified_by,verified_at)values(${id},${kind},${number},${starts},${ends},${source},${actor},now())returning id`;
 await audit(tx,actor,'Verificó póliza',policy.id);return {saved:true};
}
export async function saveRegistryUnits(tx:Transaction,id:string,form:FormData,actor:string):Promise<FormResult>{
 const selected=form.getAll('units').map(String);
 const known=await tx`select name from units order by name`;
 if(selected.some(unit=>!known.some(row=>row.name===unit)))return {fieldErrors:{units:'Seleccioná únicamente unidades disponibles.'}};
 const [person]=await tx`select units from volunteers where id=${id} for update`;if(!person)return {error:'La persona ya no está disponible.'};
 if(!known.some(row=>row.name==='Voluntariado General'))return {error:'No está disponible la unidad obligatoria Voluntariado General.'};
 const units=known.filter(row=>row.name==='Voluntariado General'||selected.includes(row.name)).map(row=>String(row.name));
 if(JSON.stringify([...person.units].sort())===JSON.stringify([...units].sort()))return {saved:true};
 await tx`update volunteers set units=${units} where id=${id}`;await audit(tx,actor,'Actualizó unidades de voluntariado',id);return {saved:true};
}
export async function saveRegistryIncident(tx:Transaction,id:string,form:FormData,actor:string):Promise<FormResult>{
 const errors=validateRegistryForm(form,'incident');if(Object.keys(errors).length)return {fieldErrors:errors};
 const [person]=await tx`select id from volunteers where id=${id} for update`;if(!person)return {error:'La persona ya no está disponible.'};
 const outing=field(form,'outing'),occurred=field(form,'occurred_on'),description=field(form,'description');
 if(outing&&!(await tx`select 1 from registrations where volunteer_id=${id} and outing_id=${outing}`).length)return {error:'La salida ya no está vinculada a esta persona. Revisá la evidencia antes de registrar el incidente.'};
 const [existing]=await tx`select id from volunteer_incidents where volunteer_id=${id} and outing_id is not distinct from ${outing||null}::uuid and occurred_on=${occurred}::date and description=${description} and recorded_by=${actor}`;
 if(existing)return {saved:true};
 const [incident]=await tx`insert into volunteer_incidents(volunteer_id,outing_id,occurred_on,description,recorded_by)values(${id},${outing||null},${occurred},${description},${actor})returning id`;
 await audit(tx,actor,'Registró incidente de voluntariado',incident.id);return {saved:true};
}
export async function saveRegistryGrant(tx:Transaction,form:FormData,actor:string,demo:boolean):Promise<FormResult>{
 const errors=validateRegistryForm(form,'grant');if(field(form,'subject')==='local-coordination'&&!demo)errors.subject='Ingresá un identificador de objeto Entra válido.';
 const role=field(form,'role'),unit=role==='unidad'?field(form,'unit'):'',subject=field(form,'subject');
 if(role==='unidad'&&unit&&!(await tx`select 1 from units where name=${unit}`).length)errors.unit='Seleccioná una unidad disponible.';
 if(Object.keys(errors).length)return {fieldErrors:errors};
 if(field(form,'action')==='revocar'&&subject===actor&&role==='admin')return {error:'No podés revocar tu propio permiso de Administración.'};
 // Serialize identical permission operations, including when the assignment does not exist yet.
 await tx`select pg_advisory_xact_lock(hashtextextended(${subject+'/'+role+'/'+unit},0))`;
 const rows=field(form,'action')==='revocar'?await tx`delete from grants where subject=${subject} and role=${role} and unit=${unit} returning subject`:await tx`insert into grants values(${subject},${role},${unit})on conflict do nothing returning subject`;
 if(rows.length)await audit(tx,actor,field(form,'action')==='revocar'?'Revocó permiso':'Asignó permiso',subject,`${role} ${unit}`);
 return {saved:true};
}
