'use client';

import { ActionModal } from '../action-modal';
import { updateVolunteerUnits } from '../../staff-actions';

export function VolunteerUnits({ volunteerId, units, selected }: {
  volunteerId: string; units: string[]; selected: string[];
}) {
  return <ActionModal id="unidades" title="Actualizar unidades" successMessage="Unidades actualizadas." saveLabel="Guardar unidades" action={updateVolunteerUnits.bind(null,volunteerId)}>
    <fieldset className="volunteer-unit-options">
      <legend>Unidades de voluntariado</legend>
      <label><input type="checkbox" checked disabled /> Voluntariado General (obligatorio)</label>
      {units.filter(unit => unit !== 'Voluntariado General').map(unit => <label key={unit}>
        <input type="checkbox" name="units" value={unit} defaultChecked={selected.includes(unit)} />{unit}
      </label>)}
    </fieldset>
  </ActionModal>;
}
