'use client';

import { useState } from 'react';

export function InheritedField({ name, label, general, current, overridden, multiline, options }: {
  name: string;
  label: string;
  general: string;
  current: string;
  overridden: boolean;
  multiline?: boolean;
  options?: string[];
}) {
  const [personal, setPersonal] = useState(overridden);
  const [value, setValue] = useState(current);
  const shown = personal ? value : general;

  return <div>
    <label><input type="checkbox" name="personal" value={name} checked={personal}
      onChange={event => setPersonal(event.target.checked)} /> Personalizar {label.toLowerCase()} para este bloque</label>
    <label>{label}
      {options ? <select name={name} disabled={!personal} value={shown} onChange={event => setValue(event.target.value)}>
        {!options.includes(shown) && <option value={shown} disabled>{shown}</option>}
        {options.map(option => <option key={option}>{option}</option>)}
      </select> : multiline ? <textarea name={name} disabled={!personal} value={shown} onChange={event => setValue(event.target.value)} />
        : <input name={name} disabled={!personal} value={shown} required onChange={event => setValue(event.target.value)} />}
    </label>
  </div>;
}
