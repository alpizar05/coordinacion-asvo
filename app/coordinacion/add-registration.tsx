'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoordinationModal } from './coordination-modal';
import { StatusRibbon } from '../status-ribbon';
import { addRegistration, findRegistrationVolunteers } from './add-registration-actions';

type Person = { id: string; name: string; identification: string };
export function AddRegistration({ outing }: { outing: { id: string; starts: string; ends: string; flexible: boolean; general: boolean } }) {
  const [open,setOpen] = useState(false), [dirty,setDirty] = useState(false), [pending,setPending] = useState(false);
  const [query,setQuery] = useState(''), [people,setPeople] = useState<Person[]>([]), [selected,setSelected] = useState<Person | null>(null);
  const [searching,setSearching] = useState(false), [searchMessage,setSearchMessage] = useState(''), [error,setError] = useState('');
  const [transport,setTransport] = useState(false), [success,setSuccess] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const formId = useId(), router = useRouter();
  useEffect(() => {
    if (!open || selected || query.trim().length < 2) { setPeople([]); setSearching(false); return; }
    let active = true;
    setPeople([]); setSearching(true); setSearchMessage('');
    const timer = setTimeout(async () => {
      try {
        const result = await findRegistrationVolunteers(outing.id,query);
        if (!active) return;
        setPeople(result.people);
        setSearchMessage(result.error || (result.total && result.total > result.people.length ? 'Mostrando las primeras 25 coincidencias. Precisá la búsqueda.' : result.people.length ? '' : 'No se encontraron personas para esta salida.'));
      } catch { if (active) setSearchMessage('No se pudo buscar. Intentá de nuevo.'); }
      finally { if (active) setSearching(false); }
    },300);
    return () => { active = false; clearTimeout(timer); };
  },[query,selected,open,outing.id]);
  return <>
    <StatusRibbon message={success} onExpire={setSuccess} />
    <button type="button" aria-haspopup="dialog" onClick={() => {
      setSelected(null); setQuery(''); setPeople([]); setError(''); setSearchMessage(''); setDirty(false); setTransport(false); setOpen(true);
    }}>Agregar persona</button>
    <CoordinationModal title="Agregar persona a la salida" open={open} onClose={() => setOpen(false)} dirty={dirty} pending={pending}
      footer={<button type="submit" form={formId} disabled={pending || !selected} className="coord-button-primary">{pending ? 'Agregando…' : 'Agregar inscripción'}</button>}>
      {open && <form id={formId} onChange={() => setDirty(true)} onSubmit={async event => {
        event.preventDefault(); if (pending || !selected) return;
        const data = new FormData(event.currentTarget); setPending(true); setError('');
        try {
          const result = await addRegistration(outing.id,data);
          if (result.error) { setError(result.error); setTimeout(() => errorRef.current?.focus(),0); }
          else {
            setDirty(false); setOpen(false);
            setSuccess(`${selected.name}: inscripción agregada ${result.status === 'espera' ? 'a lista de espera' : 'en revisión'}. Se notificará por correo.`);
            router.refresh();
          }
        } catch { setError('No se pudo agregar la inscripción. Los datos se conservan para reintentar.'); setTimeout(() => errorRef.current?.focus(),0); }
        finally { setPending(false); }
      }}>
        {error && <p role="alert" tabIndex={-1} ref={errorRef} className="note">{error}</p>}
        <fieldset disabled={pending} className="coordination-modal-form-fields">
          <input type="hidden" name="schedule" value={`${outing.starts}/${outing.ends}/${outing.flexible}`} />
          {selected ? <div className="card"><strong>{selected.name}</strong><p>Identificación: {selected.identification}</p>
            <input type="hidden" name="volunteer" value={selected.id} />
            <button type="button" onClick={() => { setSelected(null); setDirty(true); }}>Cambiar persona</button></div>
            : <><label>Buscar persona voluntaria<input type="search" value={query} maxLength={120} autoComplete="off"
              placeholder="Nombre, identificación o correo" onChange={e => { setQuery(e.target.value); setDirty(true); }} /></label>
              <p className="muted" role="status">{searching ? 'Buscando…' : query.trim().length < 2 ? 'Escribí al menos 2 caracteres.' : searchMessage}</p>
              <ul className="registration-person-results">{people.map(person => <li key={person.id}><button type="button" onClick={() => { setSelected(person); setDirty(true); }}>
                <strong>{person.name}</strong><span>{person.identification}</span></button></li>)}</ul></>}
          <div className="form-grid">
            <label>Llegada<input name="starts" type="date" required defaultValue={outing.starts} readOnly={!outing.flexible} /></label>
            <label>Regreso<input name="ends" type="date" required defaultValue={outing.ends} readOnly={!outing.flexible} /></label>
          </div>
          {outing.flexible && <p className="muted">Podés indicar menos días o ampliar la participación. Las fechas deben intersectar el periodo de la salida; se revisarán al confirmar.</p>}
          <label><input type="checkbox" name="transport" checked={transport} onChange={e => setTransport(e.target.checked)} /> Tiene transporte propio</label>
          {transport && <label>Personas que puede llevar<input type="number" name="rides" min="0" max="100" defaultValue="0" required /></label>}
          {!transport && <input type="hidden" name="rides" value="0" />}
          <label>Restricciones alimentarias<textarea name="food" maxLength={500} /></label>
          {outing.general && <label><input type="checkbox" name="lead" /> Tiene interés en ser 70</label>}
          <label>Otras observaciones<textarea name="other" maxLength={500} /></label>
          <p className="muted">La inscripción queda en revisión si hay cupo o en lista de espera si está completo. Se enviará un correo a la persona voluntaria.</p>
        </fieldset>
      </form>}
    </CoordinationModal>
  </>;
}
