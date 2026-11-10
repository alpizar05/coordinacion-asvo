'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoordinationModal } from './coordination-modal';
import { StatusRibbon } from '../status-ribbon';
import { loadEditableRegistration, saveEditedRegistration } from './edit-registration-actions';

type Data = NonNullable<Awaited<ReturnType<typeof loadEditableRegistration>>['data']>;
export function EditRegistration({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [data,setData] = useState<Data | null>(null), [error,setError] = useState(''), [success,setSuccess] = useState('');
  const [loading,setLoading] = useState(false), [pending,setPending] = useState(false), [dirty,setDirty] = useState(false);
  const [transport,setTransport] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null), formId = useId(), router = useRouter();
  useEffect(() => {
    if (!open) return;
    let active = true;
    setData(null); setError(''); setLoading(true); setDirty(false);
    loadEditableRegistration(id).then(result => {
      if (!active) return;
      if (result.data) { setData(result.data); setTransport(result.data.transport); }
      else setError(result.error || 'No se pudo cargar la inscripción.');
    }).catch(() => { if (active) setError('No se pudo cargar. Cerrá el modal e intentá de nuevo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  },[id,open]);
  return <>
    <StatusRibbon message={success} onExpire={setSuccess} />
    <CoordinationModal open={open} onClose={onClose} title="Editar inscripción" dirty={dirty} pending={pending}
      footer={<button type="submit" form={formId} disabled={pending || loading || !data} className="coord-button-primary">{pending ? 'Guardando…' : 'Guardar cambios'}</button>}>
      {loading && <p role="status">Cargando inscripción…</p>}
      {error && <p role="alert" className="note" ref={errorRef} tabIndex={-1}>{error}</p>}
      {open && data && <form id={formId} onChange={() => setDirty(true)} onSubmit={async event => {
        event.preventDefault(); if (pending) return;
        const form = new FormData(event.currentTarget); setPending(true); setError('');
        try {
          const result = await saveEditedRegistration(id,form);
          if (result.error) { setError(result.error); setTimeout(() => errorRef.current?.focus(),0); }
          else { setDirty(false); onClose(); setSuccess('Inscripción actualizada. Se notificará a la persona voluntaria por correo.'); router.refresh(); }
        } catch { setError('No se pudo guardar. Los datos se conservan para reintentar.'); setTimeout(() => errorRef.current?.focus(),0); }
        finally { setPending(false); }
      }}>
        <p><strong>{data.name}</strong></p>
        <fieldset className="coordination-modal-form-fields" disabled={pending}>
          <input type="hidden" name="version" value={data.version} />
          <label>Llegada<input name="starts" type="date" required defaultValue={data.starts} readOnly={!data.flexible} /></label>
          <label>Regreso<input name="ends" type="date" required defaultValue={data.ends} readOnly={!data.flexible} /></label>
          {data.confirmed && data.flexible && <p className="muted">Si cambiás las fechas, la inscripción volverá a revisión y conservará su cupo reservado. Deberás confirmar las nuevas fechas.</p>}
          <label><input name="transport" type="checkbox" checked={transport} onChange={e => setTransport(e.target.checked)} /> Tiene transporte propio</label>
          {transport ? <label>Personas que puede llevar<input name="rides" type="number" min="0" max="100" required defaultValue={data.seats} /></label>
            : <input name="rides" type="hidden" value="0" />}
          {data.legacySeats && <p className="muted">La inscripción anterior ofrecía transporte sin indicar cantidad. Revisá cuántas personas puede llevar.</p>}
          <label>Restricciones alimentarias<textarea name="food" maxLength={500} defaultValue={data.food} /></label>
          {data.general && <label><input name="lead" type="checkbox" defaultChecked={data.interested70} /> Tiene interés en ser 70</label>}
          <label>Otras observaciones<textarea name="other" maxLength={500} defaultValue={data.other} /></label>
        </fieldset>
      </form>}
    </CoordinationModal>
  </>;
}
