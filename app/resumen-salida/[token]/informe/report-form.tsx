'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { labourOptions, activityOptions } from '../../../../lib/outing-report-options';
import { submitReport } from './actions';
import type { ReportValues } from '../../../../lib/outing-report';

export function ReportForm({ token, initial, lead, participants, selected = [] }: {
  token: string; initial: ReportValues; lead: { name: string; email: string };
  participants: { id: string; name: string }[]; selected?: string[];
}) {
  const [values, setValues] = useState(initial);
  const [attended, setAttended] = useState(selected);
  const [accuracy, setAccuracy] = useState(false);
  const [state, action, pending] = useActionState(submitReport.bind(null,token), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.errors) form.current?.querySelector<HTMLElement>('[aria-invalid=true]')?.focus();
  }, [state]);
  const fields: { name: Exclude<keyof ReportValues, 'labour' | 'activity'>; label: string; multiline?: boolean; max?: number; optional?: boolean; type?: string; help?: string }[] = [
    { name: 'location', label: 'Área silvestre protegida o lugar visitado', help: 'Precargado con el lugar de la convocatoria.' },
    { name: 'starts', label: 'Fecha de inicio real de la gira', type: 'date' },
    { name: 'ends', label: 'Fecha de finalización real de la gira', type: 'date' },
    { name: 'actions', label: 'Describí las acciones realizadas', multiline: true, max: 10000 },
    { name: 'host', label: 'Persona funcionaria del SINAC a cargo o responsable de la actividad' },
    { name: 'observations', label: 'Observaciones o recomendaciones', multiline: true, max: 5000, optional: true },
  ];
  return <form ref={form} action={action} className="outing-report-form">
    {participants.map(person => <input key={person.id} type="hidden" name="roster" value={person.id} />)}
    <section className="card"><h2>Persona responsable del equipo (70)</h2>
      <p><strong>{lead.name}</strong><br />{lead.email || 'Correo pendiente de registrar'}</p>
      <p className="muted">Estos datos provienen de tu ficha. La fecha y hora de presentación se registran automáticamente al enviar.</p>
      {state.errors?.email && <p className="note" role="alert">{state.errors.email}</p>}
    </section>
    <section className="card"><h2>Informe de la actividad</h2>
      <p>Revisá los datos precargados y completá la información de lo que realmente ocurrió. Todos los campos son obligatorios salvo Observaciones.</p>
      <div className="report-fields">
        <fieldset tabIndex={-1} aria-invalid={!!state.errors?.labour} aria-describedby="report-help-labour">
          <legend>Tipo de labor realizada</legend>
          {labourOptions.map(option => <label key={option}>
            <input type="checkbox" name="labour" value={option} checked={values.labour.includes(option)}
              onChange={event => setValues(current => ({ ...current, labour: event.target.checked ? [...current.labour,option] : current.labour.filter(value => value !== option) }))} />
            {option}
          </label>)}
          <p id="report-help-labour" className={state.errors?.labour ? 'report-error' : 'muted'}>
            {state.errors?.labour || 'Podés seleccionar varias opciones. La sugerencia inicial se basa en la unidad de la convocatoria; revisala según la labor realizada.'}
          </p>
        </fieldset>
        <label>Tipo de gira según la actividad realizada
          <select name="activity" required value={values.activity} aria-invalid={!!state.errors?.activity} aria-describedby="report-help-activity"
            onChange={event => setValues({ ...values, activity: event.target.value })}>
            <option value="">Seleccioná una opción</option>
            {activityOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <span id="report-help-activity" className={state.errors?.activity ? 'report-error' : 'muted'}>
            {state.errors?.activity || 'Seleccioná la opción que mejor describe las actividades más destacadas o el objetivo de la gira.'}
          </span>
        </label>
        {fields.map(item => <label key={item.name}>
        {item.label}{item.optional ? ' (opcional)' : ''}
        {item.multiline ? <textarea name={item.name} value={values[item.name]} required={!item.optional} maxLength={item.max}
          aria-invalid={!!state.errors?.[item.name]} aria-describedby={`report-help-${item.name}`}
          onChange={event => setValues({ ...values, [item.name]: event.target.value })} />
          : <input name={item.name} type={item.type || 'text'} value={values[item.name]} required={!item.optional} maxLength={item.type ? undefined : 500}
            aria-invalid={!!state.errors?.[item.name]} aria-describedby={`report-help-${item.name}`}
            onChange={event => setValues({ ...values, [item.name]: event.target.value })} />}
        <span id={`report-help-${item.name}`} className={state.errors?.[item.name] ? 'report-error' : 'muted'}>
          {state.errors?.[item.name] || item.help || (item.type ? 'Precargada con las fechas de la convocatoria; podés corregirla.' : '')}
        </span>
      </label>)}</div>
    </section>
    <section className="card"><h2>Participación real del equipo</h2>
      <p>La lista proviene de las inscripciones confirmadas. Marcá únicamente a quienes participaron realmente. Las personas sin marcar quedarán registradas como no participantes en este informe.</p>
      <p role="status"><strong>{attended.length} de {participants.length}</strong> personas con participación confirmada por vos.</p>
      <fieldset aria-invalid={!!state.errors?.participants} tabIndex={-1}>
        <legend>Confirmación de asistencia</legend>
        {participants.map(person => <label key={person.id}>
          <input type="checkbox" name="attended" value={person.id} checked={attended.includes(person.id)}
            onChange={event => setAttended(current => event.target.checked ? [...current,person.id] : current.filter(id => id !== person.id))} />
          {person.name}
        </label>)}
        {!participants.length && <p>No hay inscripciones confirmadas. Contactá a Coordinación.</p>}
      </fieldset>
      {state.errors?.participants && <p role="alert" className="report-error">{state.errors.participants}</p>}
      <p className="muted">Si falta una persona que sí participó, contactá a Coordinación para conciliar su inscripción antes de enviar el informe.</p>
    </section>
    <section className="card">
      <label><input type="checkbox" name="accuracy" checked={accuracy} required aria-invalid={!!state.errors?.accuracy}
        onChange={event => setAccuracy(event.target.checked)} />Confirmo que revisé las personas que participaron y que este informe refleja lo realizado.</label>
      {state.errors?.accuracy && <p role="alert" className="report-error">{state.errors.accuracy}</p>}
      {state.errors?.form && <p className="note" role="alert">{state.errors.form}</p>}
      <button type="submit" disabled={pending || !lead.email || !participants.length}>{pending ? 'Enviando…' : 'Enviar informe de salida'}</button>
    </section>
  </form>;
}
