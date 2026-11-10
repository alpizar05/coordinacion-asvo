'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { useFormStatus } from 'react-dom';
import { updateVolunteerUnits } from '../../staff-actions';

const subscribe = (callback: () => void) => {
  const media = window.matchMedia('(max-width: 700px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const snapshot = () => window.matchMedia('(max-width: 700px)').matches;

function SaveUnits() {
  const { pending } = useFormStatus();
  return <button className="coord-button-primary" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar unidades'}</button>;
}

export function VolunteerUnits({ volunteerId, units, selected }: {
  volunteerId: string; units: string[]; selected: string[];
}) {
  const mobile = useSyncExternalStore(subscribe, snapshot, () => false);
  const modal = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => { modal.current?.close(); }, [selected]);
  const form = <form action={updateVolunteerUnits.bind(null, volunteerId)}>
    <fieldset className="volunteer-unit-options">
      <legend>Unidades de voluntariado</legend>
      <label><input type="checkbox" checked disabled /> Voluntariado General (obligatorio)</label>
      {units.filter(unit => unit !== 'Voluntariado General').map(unit => <label key={unit}>
        <input type="checkbox" name="units" value={unit} defaultChecked={selected.includes(unit)} />{unit}
      </label>)}
    </fieldset>
    <SaveUnits />
  </form>;
  if (!mobile) return <details id="unidades"><summary>Actualizar unidades</summary>{form}</details>;
  return <div id="unidades">
    <button ref={trigger} type="button" aria-haspopup="dialog" onClick={() => {
      modal.current?.querySelector('form')?.reset();
      modal.current?.showModal();
    }}>Actualizar unidades</button>
    <dialog ref={modal} className="table-filter-modal volunteer-units-modal" aria-labelledby={id}
      onClose={() => trigger.current?.focus()} onClick={event => {
        if (event.target === event.currentTarget) modal.current?.close();
      }}>
      <header className="table-filter-heading"><h2 id={id}>Actualizar unidades</h2>
        <button type="button" className="table-filter-close" aria-label="Cerrar unidades" onClick={() => modal.current?.close()}>×</button>
      </header>
      {form}
    </dialog>
  </div>;
}
