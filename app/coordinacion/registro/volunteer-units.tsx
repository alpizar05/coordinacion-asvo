'use client';

import { FormFieldGroup } from '../../form-feedback/form-feedback';
import { ActionModal } from '../action-modal';
import { updateVolunteerUnits } from '../../actions/volunteers';

export function VolunteerUnits({ volunteerId, units, selected }: {
  volunteerId: string; units: string[]; selected: string[];
}) {
  return <ActionModal id="unidades" title="Actualizar unidades" successMessage="Unidades actualizadas." saveLabel="Guardar unidades" action={updateVolunteerUnits.bind(null,volunteerId)}>
    <FormFieldGroup name="units" label="Unidades de voluntariado">
      <label><input type="checkbox" checked disabled /> Voluntariado General (obligatorio)</label>
      {units.filter(unit => unit !== 'Voluntariado General').map(unit => <label key={unit}>
        <input type="checkbox" name="units" value={unit} defaultChecked={selected.includes(unit)} />{unit}
      </label>)}
    </FormFieldGroup>
  </ActionModal>;
}
