'use client';

import { useActionState, useState } from 'react';
import { generateBrief, revokeBrief } from './actions';
import { StatusRibbon } from '../../../../status-ribbon';

export function ShareBrief({ id, leads }: { id: string; leads: { id: string; name: string }[] }) {
  const [result, action, pending] = useActionState(generateBrief.bind(null,id), {});
  const [message, setMessage] = useState('');
  const [revoked, setRevoked] = useState(false);
  const [revoking, setRevoking] = useState(false);
  return <section className="card brief-share">
    <h2>Compartir con el 70</h2>
    <p>El enlace permite consultar este resumen y presentar el informe de salida durante siete días. Mostrará la información actualizada y dejará de funcionar si se retira la asignación de 70. Compartilo únicamente con la persona asignada.</p>
    {leads.length ? <form action={action} onSubmit={() => setRevoked(false)}>
      <label>Persona asignada como 70<select name="lead" required>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label>
      <button className="coord-button-primary" type="submit" disabled={pending || revoking}>{pending ? 'Generando…' : 'Generar enlace privado'}</button>
    </form> : <p>Primero confirmá una inscripción y asigná a esa persona como 70 desde Gestionar.</p>}
    {result.error && <p role="alert" className="note">{result.error}</p>}
    {result.link && !revoked && <div className="brief-share-result">
      <label>Enlace privado<input value={result.link} readOnly onFocus={event => event.currentTarget.select()} /></label>
      <div className="actions"><a className="button" href={result.link} target="_blank" rel="noreferrer">Abrir resumen</a>
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(result.link!); setMessage('Enlace del resumen copiado.'); }
          catch { setMessage('Seleccioná el enlace para copiarlo.'); }
        }}>Copiar enlace</button>
        <a className="button" href={`https://wa.me/?text=${encodeURIComponent('Resumen privado de la salida para el 70: ' + result.link)}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>
      </div>
    </div>}
    <button type="button" className="coord-button-danger" disabled={revoking || pending} onClick={async () => {
      setRevoking(true);
      try { await revokeBrief(id); setRevoked(true); setMessage('Los enlaces del resumen fueron revocados.'); }
      catch { setMessage('No se pudieron revocar los enlaces. Volvé a intentarlo.'); }
      finally { setRevoking(false); }
    }}>{revoking ? 'Revocando…' : 'Revocar enlaces del resumen'}</button>
    <StatusRibbon message={message} onExpire={setMessage} />
  </section>;
}
