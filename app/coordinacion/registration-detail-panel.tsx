'use client';

import { useEffect, useState } from 'react';
import { loadRegistrationDetail } from './registration-detail-actions';
import { RegistrationDetails } from './registration-details';
import { RegistrationHistoryView } from './registration-history-view';

type Data = NonNullable<Awaited<ReturnType<typeof loadRegistrationDetail>>['data']>;
export function RegistrationDetailPanel({ id }: { id: string }) {
  const [data,setData] = useState<Data | null>(null), [error,setError] = useState(''), [attempt,setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setData(null); setError('');
    loadRegistrationDetail(id).then(result => { if (active) { if (result.data) setData(result.data); else setError(result.error || 'No se pudo cargar.'); } })
      .catch(() => { if (active) setError('No se pudo cargar la inscripción. Intentá de nuevo.'); });
    return () => { active = false; };
  },[id,attempt]);
  if (error) return <div><p role="alert" className="note">{error}</p><button type="button" onClick={()=>setAttempt(value=>value+1)}>Reintentar</button></div>;
  if (!data) return <p role="status">Cargando inscripción e historial…</p>;
  return <><RegistrationDetails entry={{...data.entry,received:data.entry.received ? new Intl.DateTimeFormat('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'short',timeStyle:'short'}).format(new Date(data.entry.received)) : 'Sin fecha original'}} general={data.general} />
    <RegistrationHistoryView history={data.history} received={data.entry.received} /></>;
}
