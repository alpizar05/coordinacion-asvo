'use client';

import { StatusRibbon } from '../../../status-ribbon';

import { useState } from 'react';

export function ShareCollection() {
  const [status, setStatus] = useState('');
  return <div className="actions">
    <button type="button" onClick={async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setStatus('Enlace copiado.');
      } catch {
        setStatus('Copiá el enlace desde la barra de direcciones.');
      }
    }}>Copiar enlace</button>
    <StatusRibbon message={status} onExpire={setStatus} />
  </div>;
}
