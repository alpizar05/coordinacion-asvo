'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {validateDateFilter} from '../../../lib/filter-validation';
import {FormFeedbackProvider,FormField,FormErrorSummary,useFormFeedback} from '../../form-feedback/form-feedback';
import { TableFilters } from '../table-filters';

export function StatusFilter({ value, statuses, units, unit, from, to, path = '/coordinacion/inscripciones', title = 'Filtrar inscripciones' }: {
  path?: string;
  title?: string;
  value: string;
  statuses: readonly (readonly [string, string])[];
  units: string[];
  unit: string;
  from: string;
  to: string;
}) {
  const router = useRouter(),form=useRef<HTMLFormElement>(null),reveal=useRef<(()=>void)|null>(null);
  const feedback=useFormFeedback({form,revealField:()=>reveal.current?.()});
  const [selection,setSelection] = useState({estado:value,unidad:unit,desde:from,hasta:to});
  useEffect(()=>setSelection({estado:value,unidad:unit,desde:from,hasta:to}),[value,unit,from,to]);

  useEffect(()=>{feedback.showErrors(validateDateFilter(selection.desde,selection.hasta),'',false);},[selection.desde,selection.hasta]);

  function update(key: keyof typeof selection, value: string) {
    const next = {...selection,[key]:value};
    setSelection(next);
    const query = new URLSearchParams();
    for (const [name,field] of Object.entries(next)) if (field) query.set(name,field);
    router.replace(`${path}?${query}`,{scroll:false});
  }
  return <FormFeedbackProvider feedback={feedback}><FormErrorSummary purpose="aplicar los filtros"/><TableFilters revealRef={reveal} title={title} active={!!(value !== 'todos' || unit || from || to)}><form ref={form} className="outings-filters" noValidate onSubmit={event=>{event.preventDefault();feedback.showErrors(validateDateFilter(selection.desde,selection.hasta));}}>
    <FormField name="estado" label="Estado"><select name="estado" value={selection.estado} onChange={event=>update('estado',event.target.value)}>
      <option value="todos">Todos</option>
      {statuses.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
    </select></FormField>
    <FormField name="unidad" label="Unidad"><select name="unidad" value={selection.unidad} onChange={event=>update('unidad',event.target.value)}>
      <option value="">Todas</option>
      {units.map(name => <option key={name}>{name}</option>)}
    </select></FormField>
    <FormField name="desde" label="Desde"><input type="date" name="desde" value={selection.desde} onChange={event=>update('desde',event.target.value)} /></FormField>
    <FormField name="hasta" label="Hasta"><input type="date" name="hasta" value={selection.hasta} onChange={event=>update('hasta',event.target.value)} /></FormField>
  </form></TableFilters></FormFeedbackProvider>;
}
