'use client';

import { useRef, type ReactNode } from 'react';

export type OutingPeriod = { id: number; start: string; end: string };

export function OutingPeriods({ limit, periods, onChange, renderError }: {
  limit: number;
  periods: OutingPeriod[];
  onChange: (periods: OutingPeriod[]) => void;
  renderError: (id: number) => ReactNode;
}) {
  const nextId = useRef(2);

  function updatePeriod(id: number, dates: Partial<Pick<OutingPeriod, 'start' | 'end'>>) {
    onChange(periods.map(period => period.id === id ? { ...period, ...dates } : period));
  }

  return <fieldset tabIndex={-1} data-feedback-fields="dates" data-feedback-label="Bloques de fechas">
    <legend>Bloques de fechas</legend>
    <p>Cada bloque crea una convocatoria con los mismos datos y sus propios cupos e inscripciones.</p>
    {periods.map(({ id, start, end }, index) => <fieldset key={id}>
      <legend>Bloque {index + 1}</legend>
      <input type="hidden" name="periodId" value={id}/><input type="hidden" name="starts" value={start}/><input type="hidden" name="ends" value={end}/>
      {renderError(id)}
      <div className="grid">
        <label>Llegada<input name={`period-${id}-starts`} aria-label={`Periodo ${index+1}: llegada`} type="date" value={start} onChange={event => {
          const start = event.currentTarget.value;
          const suggested = new Date(start);
          if (Number.isNaN(suggested.getTime())) {
            updatePeriod(id, { start });
            return;
          }
          suggested.setUTCDate(suggested.getUTCDate() + 2);
          updatePeriod(id, { start, end: suggested.toISOString().split('T')[0] });
        }} required /></label>
        <label>Regreso<input name={`period-${id}-ends`} aria-label={`Periodo ${index+1}: regreso`} type="date" value={end} onChange={event =>
          updatePeriod(id, { end: event.currentTarget.value })
        } required /></label>
      </div>
      {index > 0 && <button type="button" onClick={() => onChange(periods.filter(period => period.id !== id))}>
        Quitar bloque {index + 1}
      </button>}
    </fieldset>)}
    <button type="button" disabled={periods.length >= limit} onClick={() =>
      onChange([...periods, { id: nextId.current++, start: '', end: '' }])
    }>Agregar otro bloque de fechas</button>
  </fieldset>;
}
