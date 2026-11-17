'use client';
// UI-only fixtures. No actions, database or provider calls.
import {useEffect,useState} from 'react';
import {PhotoDialog} from '../coordinacion/photo-dialog';
import {ActionModal} from '../coordinacion/action-modal';
import {ConfirmationProvider} from '../status-ribbon';
import '../coordinacion/coordination.css';
const gallery=Array.from({length:8},(_,i)=>({id:`11111111-1111-4111-8111-${String(i+1).padStart(12,'0')}`,alt:`Paisaje ficticio ${i+1}`,credit:'ASVO · fixture',title:'Salida ficticia',location:'Lugar de prueba'}));
export default function Page(){const[ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);const[mode,setMode]=useState('error'),[calls,setCalls]=useState(0),[prepared,setPrepared]=useState(0),[saved,setSaved]=useState(0),[last,setLast]=useState(''),[attempt,setAttempt]=useState(0);
 async function execute(operation,choice){const first=attempt===0;setAttempt(n=>n+1);setCalls(n=>n+1);setLast(`${choice.kind}: ${choice.alt} / ${choice.credit}`);if(mode.startsWith('delay'))await new Promise(r=>setTimeout(r,5000));if(mode==='throw')throw Error('Fictitious persistence rejection');if(mode==='missing')return undefined;if(!mode.endsWith('success')||(mode.includes('retry-success')&&first))return {error:'Fallo ficticio. Archivo y metadatos conservados.',fieldErrors:{alt:['Revisá la descripción ficticia.'],credit:'Revisá el crédito ficticio.'}};if(operation==='prepare'){setPrepared(n=>n+1);return {prepared:true};}setSaved(n=>n+1);return {saved:true};}
 return <ConfirmationProvider><><div className="coordination-content" data-photo-ready={ready?'yes':'no'}><h1>Prueba local de fotografías</h1><p>Sin persistencia ni proveedores.</p><label>Resultado simulado<select value={mode} onChange={e=>{setMode(e.target.value);setAttempt(0);}}>{['error','delay-error','success','retry-success','delay-success','delay-retry-success','throw','missing'].map(v=><option key={v}>{v}</option>)}</select></label><div><output aria-label="Invocaciones">{calls}</output> / <output aria-label="Preparadas">{prepared}</output> / <output aria-label="Guardadas">{saved}</output><p aria-label="Última elección">{last}</p></div>
 <section className="card" aria-label="Preparación"><h2>Nueva salida / preparación</h2><PhotoDialog operation="prepare" gallery={gallery} onSave={choice=>execute('prepare',choice)}/></section>
 <section className="card" aria-label="Persistencia"><h2>Detalle de salida / persistencia</h2><PhotoDialog operation="persist" gallery={gallery} onSave={choice=>execute('persist',choice)}/></section>
 <section className="card" aria-label="Edición"><h2>Metadatos de una foto existente</h2><PhotoDialog operation="prepare" initial={{kind:'edit',id:gallery[0].id,alt:'Descripción conservada',credit:'Crédito conservado'}} onSave={choice=>execute('prepare',choice)}/></section>
 <section className="card" aria-label="Referencia de Coordinación"><h2>Otro modal</h2><ActionModal title="Formulario de referencia" action={async()=>({error:'Error de referencia'})}><label>Dato<input name="detail" defaultValue="Conservado"/></label></ActionModal></section>
 </div><section className="card" aria-label="Referencia pública"><h2>Superficie pública representativa</h2><button type="submit">Acción pública</button><button type="button">Secundaria pública</button></section></></ConfirmationProvider>;
}
