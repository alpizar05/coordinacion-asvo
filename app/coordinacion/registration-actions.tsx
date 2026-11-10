'use client';

import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { RowActionPanel } from './row-action-panel';
import { manageEntry } from '../staff-actions';

const labels = {
  asignar70: 'Asignar como 70',
  quitar70: 'Quitar asignación de 70',
  validar: 'Recuperar inscripción anterior',
  confirmar: 'Confirmar cupo',
  espera: 'Pasar a lista de espera',
  rechazar: 'Rechazar solicitud',
  cancelar: 'Cancelar inscripción',
};

type Action = keyof typeof labels;

const actionsByStatus: Record<string, Action[]> = {
  'validación': ['validar'],
  'revisión': ['confirmar', 'espera', 'rechazar', 'cancelar'],
  espera: ['confirmar', 'rechazar', 'cancelar'],
  confirmada: ['espera', 'rechazar', 'cancelar'],
  'cancelada por coordinación': ['confirmar'],
  'cancelada por voluntariado': ['confirmar'],
};

export function RegistrationActions({ entry, outing, personName, error, fromList = false, filter = '', details, canManage = true }: {
  entry: { id: string; status: string; identification: string; starts: string; ends: string; assigned70?: boolean };
  outing: { flexible: boolean; first_day: string; last_day: string };
  personName?: string;
  error?: string;
  fromList?: boolean;
  filter?: string;
  details?: ReactNode;
  canManage?: boolean;
}) {
  const managed = useSearchParams().get('gestionada') === entry.id;
  const [selected, setSelected] = useState<Action | 'ver' | null>(null);
  const baseActions = canManage ? actionsByStatus[entry.status] : undefined;
  const available = baseActions && entry.status === 'confirmada' && !fromList
    ? [entry.assigned70 ? 'quitar70' as const : 'asignar70' as const, ...baseActions] : baseActions;
  const viewing = selected === 'ver' && !!details;
  const action = selected && selected !== 'ver' && available?.includes(selected) ? selected : null;
  const needsReason = action === 'espera' || action === 'rechazar' || action === 'cancelar';
  const approveDates = action === 'confirmar' && outing.flexible &&
    (entry.starts < outing.first_day || entry.ends > outing.last_day);

  if (!available && !details) return error ? <p className="note" role="alert">{error}</p> : null;

  return <RowActionPanel title={viewing ? "Detalle de inscripción" : "Gestionar inscripción"} subtitle={personName} expanded={viewing}
    triggerLabel={personName ? `Gestionar inscripción de ${personName}` : undefined}
    openOnError={error} managed={managed} onClose={() => setSelected(null)}>
    {() => <>
        {error && <p className="note" role="alert">{error}</p>}
        {viewing ? <>
          <button className="registration-sheet-back" type="button" onClick={() => setSelected(null)}>Volver a gestionar</button>
          {details}
        </> : action ? <form key={action} action={manageEntry.bind(null,entry.id,fromList,filter)}>
          <h3>{labels[action]}</h3>
          {action === 'validar' && <label>Identificación para conciliar
            <input name="identification" defaultValue={entry.identification} />
          </label>}
          {approveDates && <label className="note">
            <input type="checkbox" name="approveDates" value={`${entry.starts}/${entry.ends}`} required />
            Apruebo las fechas solicitadas fuera del rango publicado.
          </label>}
          {needsReason && <label>Motivo
            <input name="reason" required={needsReason} />
          </label>}
          <input type="hidden" name="action" value={action} />
          <div className="actions">
            <button className="registration-sheet-back" type="button" onClick={() => setSelected(null)}>Volver</button>
            <button className={action === 'rechazar' || action === 'cancelar' ? 'coord-button-danger' : 'coord-button-primary'} type="submit">{labels[action]}</button>
          </div>
        </form> : <ul className="registration-sheet-actions">
          {details && <li><button type="button" onClick={() => setSelected('ver')}>Ver inscripción</button></li>}
          {available?.map(option => <li key={option}>
            <button type="button" className={option === 'rechazar' || option === 'cancelar' ? 'registration-sheet-danger' : undefined}
              onClick={() => setSelected(option)}>{labels[option]}</button>
          </li>)}
        </ul>}
    </>}
  </RowActionPanel>;
}
