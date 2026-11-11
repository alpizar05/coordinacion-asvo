'use client';

import { StatusRibbon } from '../../../status-ribbon';
import { useState } from 'react';
export function CopyMessage({initial}: {initial:string}) {
  const [value,setValue] = useState(initial);
  const [status,setStatus] = useState('');
  const [error,setError] = useState('');
  return <><label>Texto del comunicado<textarea rows={7} value={value} onChange={event => setValue(event.target.value)}/></label>
  <p className="actions"><button type="button" onClick={async () => {
    try { setError(''); await navigator.clipboard.writeText(value); setStatus('Comunicado copiado.'); }
    catch { setError('No se pudo copiar. Seleccioná el texto para copiarlo manualmente.'); }
  }}>Copiar</button><a className="button" href={`https://wa.me/?text=${encodeURIComponent(value)}`} target="_blank" rel="noreferrer">Compartir en WhatsApp</a></p>
  {error && <p className="note" role="alert">{error}</p>}
  <StatusRibbon message={status} onExpire={setStatus} /></>;
}
