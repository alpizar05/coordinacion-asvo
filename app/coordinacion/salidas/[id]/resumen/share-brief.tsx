'use client';

import { useState } from 'react';
import {PrivateLinkForm} from '../../../private-link-form';
import { revokeBrief } from '../../../../actions/communications';
import { StatusRibbon } from '../../../../status-ribbon';

export function ShareBrief({ id, leads }: { id: string; leads: { id: string; name: string }[] }) {
  const[link,setLink]=useState(''),[pending,setPending]=useState(false);
  const [message, setMessage] = useState('');
  const [revoked, setRevoked] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error,setError] = useState('');

  return <section className="card brief-share">
    <h2>Compartir con el 70</h2>
    <p>El enlace permite consultar este resumen y presentar el informe de salida durante siete días. Mostrará la información actualizada y dejará de funcionar si se retira la asignación de 70. Compartilo únicamente con la persona asignada.</p>
    {leads.length?<PrivateLinkForm id={id} kind="brief" leads={leads} disabled={revoking} onPending={setPending} onGenerated={value=>{setLink(value);setRevoked(false);setError('');setMessage('Enlace privado para el 70 generado.');}}/>:<p>Primero confirmá una inscripción y asigná a esa persona como 70 desde Gestionar.</p>}
    {link && !revoked && <div className="brief-share-result">
      <label>Enlace privado<input value={link} readOnly onFocus={event => event.currentTarget.select()} /></label>
      <div className="actions"><a className="button" href={link} target="_blank" rel="noreferrer">Abrir resumen</a>
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(link!); setMessage('Enlace del resumen copiado.'); }
          catch { setError('No se pudo copiar. Seleccioná el enlace para copiarlo manualmente.'); }
        }}>Copiar enlace</button>
        <a className="button" href={`https://wa.me/?text=${encodeURIComponent('Resumen privado de la salida para el 70: ' + link)}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>
      </div>
    </div>}
    <button type="button" className="coord-button-danger" disabled={revoking || pending} onClick={async () => {
      setRevoking(true); setError(''); setMessage('');
      try { const result = await revokeBrief(id); if (result.saved === true) { setRevoked(true); setMessage('Los enlaces del resumen fueron revocados.'); } else setError(result.error || 'No se pudo confirmar la revocación. Volvé a intentarlo.'); }
      catch { setError('No se pudieron revocar los enlaces. Volvé a intentarlo.'); }
      finally { setRevoking(false); }
    }}>{revoking ? 'Revocando…' : 'Revocar enlaces del resumen'}</button>
    {error && <p className="note" role="alert">{error}</p>}
    <StatusRibbon message={message} onExpire={setMessage} />
  </section>;
}
