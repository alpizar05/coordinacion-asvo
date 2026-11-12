'use client';
import { navigationSaved } from './navigation-position';

import { RegistrationDetailPanel } from './registration-detail-panel';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ReportReminder } from './report-reminder';
import { EditRegistration } from './edit-registration';
import { RowActionPanel } from './row-action-panel';
import { ManageRegistrationForm } from './manage-registration-form';
import { StatusRibbon } from '../status-ribbon';
import { useRouter } from 'next/navigation';

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

export function RegistrationActions({ entry, outing, personName, error, fromList = false, filter = '', fromSummary = false, canManage = true, reportFollowup }: {
  entry: { version: string; id: string; status: string; identification: string; starts: string; ends: string; assigned70?: boolean };
  outing: { flexible: boolean; first_day: string; last_day: string };
  reportFollowup?: { outingId: string; title: string; starts: string; ends: string; email: string | null; activeLink: boolean; pending: boolean; finalized: boolean; demo: boolean };
  personName?: string;
  error?: string;
  fromList?: boolean;
  fromSummary?: boolean;
  filter?: string;
  canManage?: boolean;
}) {
  const router=useRouter();
  const [pending,setPending]=useState(false),[success,setSuccess]=useState({id:0,message:''});
  const [reminding,setReminding] = useState(false);
  const [editing,setEditing] = useState(false);
  const managed = useSearchParams().get('gestionada') === entry.id;
  const [selected, setSelected] = useState<Action | 'ver' | null>(null);
  const baseActions = canManage ? actionsByStatus[entry.status] : undefined;
  const available = baseActions && entry.status === 'confirmada' && !fromList
    ? [entry.assigned70 ? 'quitar70' as const : 'asignar70' as const, ...baseActions] : baseActions;
  const viewing = selected === 'ver';
  // Keep the chosen action mounted even if a background refresh changes the available actions.
  // The server detects the stale version and returns a general conflict.
  const action = selected && selected !== 'ver' ? selected : null;


  return <>
    <StatusRibbon key={success.id} message={success.message}/>
    {reportFollowup && !reportFollowup.finalized && reportFollowup.email && <ReportReminder open={reminding} onClose={() => setReminding(false)}
      outingId={reportFollowup.outingId} registrationId={entry.id} name={personName || 'Persona asignada como 70'} email={reportFollowup.email}
      title={reportFollowup.title} starts={reportFollowup.starts} ends={reportFollowup.ends} activeLink={reportFollowup.activeLink} demo={reportFollowup.demo} />}
    <EditRegistration id={entry.id} open={editing} onClose={() => setEditing(false)} /><RowActionPanel pending={pending} title={viewing ? "Detalle de inscripción" : "Gestionar inscripción"} subtitle={personName} expanded={viewing}
    triggerLabel={personName ? `Gestionar inscripción de ${personName}` : undefined}
    openOnError={error} managed={managed} onClose={() => setSelected(null)}>
    {close => <>
        {error && <p className="note" role="alert">{error}</p>}
        {viewing ? <>
          <button className="registration-sheet-back" type="button" onClick={() => setSelected(null)}>Volver a gestionar</button>
          <RegistrationDetailPanel id={entry.id} />
        </> : action ? <ManageRegistrationForm key={action} entry={entry} outing={outing} action={action} title={labels[action]}
          onPending={setPending} onBack={()=>setSelected(null)} onSaved={()=>{
            const messages={asignar70:'Persona asignada como 70.',quitar70:'Asignación de 70 retirada.',validar:'Inscripción anterior recuperada.',confirmar:'Inscripción confirmada.',espera:'Inscripción trasladada a lista de espera.',rechazar:'Inscripción rechazada.',cancelar:'Inscripción cancelada.'};
            navigationSaved();setSuccess(previous=>({id:previous.id+1,message:messages[action]}));close();router.refresh();
          }}/> : <ul className="registration-sheet-actions">
          <li><button type="button" onClick={() => setSelected('ver')}>Ver inscripción</button></li>
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
