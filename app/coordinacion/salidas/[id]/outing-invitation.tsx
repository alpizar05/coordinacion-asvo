'use client';

import { StatusRibbon } from '../../../status-ribbon';

import { useActionState, useEffect, useState } from 'react';
import { createOutingInvitation } from '../../../staff-actions';

export function OutingInvitation({ id }: { id: string }) {
  const [result, action, pending] = useActionState(createOutingInvitation.bind(null, id), {});
  const link = result.link;
  const [copied, setCopied] = useState('');
  const [copyError,setCopyError] = useState('');
  useEffect(()=>{if(link)setCopied('Invitación privada generada.');},[link]);
  return <>
    <p>Generá un enlace para una persona del registro y compartilo directamente. El enlace dura siete días y admite un solo envío de inscripción.</p>
    <form action={action} onSubmit={() => setCopied('')}>
      <label>Identificación de la persona voluntaria<input name="identification" required maxLength={40} /></label>
      <button className="coord-button-primary" type="submit" disabled={pending}>{pending ? 'Generando…' : 'Generar invitación'}</button>
    </form>
    {copyError && <p className="note" role="alert">{copyError}</p>}
    {result.error && <p className="note" role="alert">{result.error}</p>}
    {link && <div className="actions">
      <label>Enlace de invitación<input readOnly value={link} onFocus={event => event.currentTarget.select()} /></label>
      <button type="button" onClick={async () => {
        try {
          setCopyError('');
          await navigator.clipboard.writeText(link);
          setCopied('Enlace copiado.');
        } catch {
          setCopyError('No se pudo copiar. Seleccioná el enlace para copiarlo manualmente.');
        }
      }}>Copiar enlace</button>
      <StatusRibbon message={copied} onExpire={setCopied} />
    </div>}
  </>;
}
