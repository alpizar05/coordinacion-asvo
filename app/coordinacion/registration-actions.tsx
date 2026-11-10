'use client';

import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ReportReminder } from './report-reminder';
import { EditRegistration } from './edit-registration';
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

export function RegistrationActions({ entry, outing, personName, error, fromList = false, filter = '', fromSummary = false, details, canManage = true, reportFollowup }: {
  entry: { id: string; status: string; identification: string; starts: string; ends: string; assigned70?: boolean };
  outing: { flexible: boolean; first_day: string; last_day: string };
  reportFollowup?: { outingId: string; title: string; starts: string; ends: string; email: string | null; activeLink: boolean; pending: boolean; finalized: boolean; demo: boolean };
  personName?: string;
  error?: string;
  fromList?: boolean;
  fromSummary?: boolean;
  filter?: string;
  details?: ReactNode;
  canManage?: boolean;
}) {
  const [reminding,setReminding] = useState(false);
  const [editing,setEditing] = useState(false);
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

  if (!available && !details && !reportFollowup) return error ? <p className="note" role="alert">{error}</p> : null;

  return <>
    {reportFollowup && !reportFollowup.finalized && reportFollowup.email && <ReportReminder open={reminding} onClose={() => setReminding(false)}
      outingId={reportFollowup.outingId} registrationId={entry.id} name={personName || 'Persona asignada como 70'} email={reportFollowup.email}
      title={reportFollowup.title} starts={reportFollowup.starts} ends={reportFollowup.ends} activeLink={reportFollowup.activeLink} demo={reportFollowup.demo} />}
    <EditRegistration id={entry.id} open={editing} onClose={() => setEditing(false)} /><RowActionPanel title={viewing ? "Detalle de inscripción" : "Gestionar inscripción"} subtitle={personName} expanded={viewing}
    triggerLabel={personName ? `Gestionar inscripción de ${personName}` : undefined}
    openOnError={error} managed={managed} onClose={() => setSelected(null)}>
    {close => <>
        {error && <p className="note" role="alert">{error}</p>}
        {viewing ? <>
          <button className="registration-sheet-back" type="button" onClick={() => setSelected(null)}>Volver a gestionar</button>
          {details}
        </> : action ? <form key={action} action={manageEntry.bind(null,entry.id,fromList,filter)}>
          <h3>{labels[action]}</h3>
          {fromSummary && <input type="hidden" name="fromSummary" value="1" />}
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
          {canManage && ['revisión','espera','confirmada'].includes(entry.status) && <li><button type="button" onClick={() => { close(); setEditing(true); }}>Editar inscripción</button></li>}
          {reportFollowup && <li>{reportFollowup.finalized
            ? <Link href={`/coordinacion/salidas/${reportFollowup.outingId}/resumen?informe=${entry.id}#informe-${entry.id}`}>Ver informe finalizado</Link>
            : reportFollowup.pending ? <button type="button" disabled>Recordatorio pendiente de envío</button>
              : !reportFollowup.email ? <p className="muted">Sin correo registrado para recordar el informe.</p>
                : <button type="button" onClick={() => { close(); setReminding(true); }}>Recordar informe de salida</button>}</li>}
          {available?.map(option => <li key={option}>
            <button type="button" className={option === 'rechazar' || option === 'cancelar' ? 'registration-sheet-danger' : undefined}
              onClick={() => setSelected(option)}>{labels[option]}</button>
          </li>)}
        </ul>}
    </>}
  </RowActionPanel></>;
}
