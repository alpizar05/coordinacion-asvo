'use client';

import { compactParticipationDates } from '../../../../lib/participation-dates';


import { SectionWorkspace } from '../../section-workspace';
import {useRef} from 'react';
import {useRouter} from 'next/navigation';
import {validateManualSeries} from '../../../../lib/outing-form-validation';
import {FormFeedbackProvider,FormErrorSummary,FormFeedbackBindings,useFormFeedback} from '../../../form-feedback/form-feedback';
import { ActiveFilters } from '../../active-filters';
import { TableFilters } from '../../table-filters';
import { useState } from 'react';
import { createOutingCollection } from '../../../staff-actions';
import type { OutingRow } from '../../outings-table';

function formatDate(value: string) {
  return value.split('-').reverse().join('/');
}

export function CollectionForm({ outings }: { outings: OutingRow[] }) {
  const[pending,setPending]=useState(false);const form=useRef<HTMLFormElement>(null),busy=useRef(false),router=useRouter();
  const [step,setStep]=useState('general');
  const feedback=useFormFeedback({form,validate:validateManualSeries,labels:{outing:'Salidas de la serie'},revealField:name=>setStep(name==='outing'?'outings':'general')});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const terms = search.trim().toLocaleLowerCase('es').split(/\s+/);
  const matches = outings.filter(outing => {
    const text = [outing.title, outing.location, outing.unit, outing.starts, outing.ends,
      formatDate(outing.starts), formatDate(outing.ends)].join(' ').toLocaleLowerCase('es');
    return terms.every(term => text.includes(term));
  });

  return <FormFeedbackProvider feedback={feedback}><form ref={form} noValidate onChange={e=>{const t=e.target;if(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement)feedback.changed(t.name);}} onSubmit={async e=>{e.preventDefault();if(busy.current)return;const data=new FormData(e.currentTarget),errors=validateManualSeries(data);if(Object.keys(errors).length){feedback.showErrors(errors);return;}busy.current=true;setPending(true);try{const result=await createOutingCollection({},data);if(result.saved&&result.destination)router.push(result.destination);else feedback.showErrors(result.fieldErrors,result.error);}catch{feedback.showErrors({},'No se pudo crear la serie. La selección y los datos se conservan.');}finally{busy.current=false;setPending(false);}}}><FormErrorSummary/><FormFeedbackBindings form={form}/>
    <SectionWorkspace title="Nueva convocatoria en serie" active={step} onSelect={setStep} trackChanges discardHref="/coordinacion/convocatorias#colecciones" pending={pending}
      notice={pending?'Guardando…':`${selected.length} ${selected.length===1?'salida seleccionada':'salidas seleccionadas'}`}
      toolbar={<button type="submit" className="coord-button-primary" disabled={pending}>{pending?'Guardando…':'Crear serie'}</button>}
      sections={[
      {key:'general',label:'Información de la serie',content:<section className="card"><h2>Información de la serie</h2>
    <label>Nombre de la convocatoria en serie<input name="name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
    <label>Descripción (opcional)<textarea name="description" maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
    </section>},
    {key:'outings',label:'Seleccionar salidas',content:<section className="card"><h2>Seleccionar salidas</h2><p className="muted">La selección se conserva al buscar y cambiar de sección.</p>
    <TableFilters title="Buscar salidas" active={!!search}><label>Buscar por nombre, lugar, unidad o fecha
      <input type="search" value={search} onChange={event => setSearch(event.target.value)} />
    </label></TableFilters>
    <p role="status">{selected.length} {selected.length === 1 ? 'salida seleccionada' : 'salidas seleccionadas'}</p>
    <ActiveFilters chips={search.trim() ? [{key:'search',label:`Búsqueda: ${search.trim()}`,description:'Búsqueda',remove:() => setSearch('')}] : []} />
    {selected.map(id => <input key={id} type="hidden" name="outing" value={id} />)}
    {matches.length ? <div className="outings-scroll" tabIndex={0} role="region" aria-label="Salidas disponibles para agrupar">
      <table className="outings-table coordination-compact-table compact-select-outings">
        <thead><tr><th scope="col">Incluir</th><th scope="col">Salida</th><th scope="col">Unidad</th><th scope="col">Fechas</th><th scope="col">Estado</th></tr></thead>
        <tbody>{matches.map(outing => <tr key={outing.id}>
          <td data-label="Incluir"><input type="checkbox" data-feedback-fields="outing" data-feedback-label="Salidas de la serie" aria-labelledby={`outing-${outing.id} dates-${outing.id}`}
            checked={selected.includes(outing.id)} onChange={event => {
              const checked = event.currentTarget.checked;
              setSelected(current => checked ? [...current, outing.id] : current.filter(id => id !== outing.id));
            }} /></td>
          <th scope="row" id={`outing-${outing.id}`}>{outing.title} · {outing.location}</th>
          <td data-label="Unidad">{outing.unit}</td>
          <td data-label="Fechas" id={`dates-${outing.id}`}><span className="compact-desktop-only">{formatDate(outing.starts)} al {formatDate(outing.ends)}</span><span className="compact-mobile-only">{compactParticipationDates(outing.starts,outing.ends)}</span></td>
          <td data-label="Estado">{outing.status} · {outing.listed ? 'pública' : 'privada'}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p>No hay salidas que coincidan con la búsqueda.</p>}
    </section>},
    {key:'review',label:'Revisión final',content:<section className="card"><h2>Revisión de la serie</h2><h3>{name||'Nombre pendiente'}</h3>{description&&<p>{description}</p>}<p>{selected.length} {selected.length===1?'salida seleccionada':'salidas seleccionadas'}</p><ul>{outings.filter(o=>selected.includes(o.id)).map(o=><li key={o.id}>{o.title} · {compactParticipationDates(o.starts,o.ends)}</li>)}</ul><p className="muted">En la serie pública aparecerán solo salidas abiertas y públicas con inscripción vigente.</p>

    </section>},
    ]}/>
  </form></FormFeedbackProvider>;
}
