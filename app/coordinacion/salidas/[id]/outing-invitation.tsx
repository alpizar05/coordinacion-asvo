'use client';

import { StatusRibbon } from '../../../status-ribbon';

import { useState } from 'react';
import {PrivateLinkForm} from '../../private-link-form';

export function OutingInvitation({ id }: { id: string }) {
  const[link,setLink]=useState('');
  const [copied, setCopied] = useState('');
  const [copyError,setCopyError] = useState('');

  return <>
    <p>Generá un enlace para una persona del registro y compartilo directamente. El enlace dura siete días y admite un solo envío de inscripción.</p>
    <PrivateLinkForm id={id} kind="invitation" onGenerated={value=>{setLink(value);setCopied('Invitación privada generada.');}}/>
    {copyError && <p className="note" role="alert">{copyError}</p>}

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
