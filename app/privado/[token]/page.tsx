import { StatusRibbon } from '../../status-ribbon';
import { statusLabels } from '../../coordinacion/registration-statuses';
import { sql } from '../../../lib/db';
import { cancellationWarning, digest, displayDate } from '../../../lib/registration';
import { PrivateRegistrationForms } from '../private-registration-forms';

export default async function Page({params,searchParams}: {params:Promise<{token:string}>;searchParams:Promise<{error?:string;actualizada?:string}>}) {
  const {token} = await params;
  const [entry] = /^[\w-]{43}$/.test(token) ? await sql`select l.purpose,r.status,r.details,r.starts::text,r.ends::text,
    o.title,o.unit,o.status as outing_status,o.flexible,o.starts::text as first_day,o.ends::text as last_day
    from links l join registrations r on r.id=l.registration_id join outings o on o.id=r.outing_id
    where l.digest=${digest(token)} and l.expires>now()` : [];
  if (!entry) return <><h1>Enlace privado</h1><p>El enlace venció o ya se utilizó. Si necesitás ayuda, contactá a coordinación.</p></>;
  const active = ['revisión','espera','confirmada'].includes(entry.status) && ['abierta','confirmada'].includes(entry.outing_status);
  const query = await searchParams;
  const warning = cancellationWarning(entry.starts);
  return <><h1>{entry.title}</h1><p>{displayDate(entry.starts)} al {displayDate(entry.ends)}</p>
  {query.error && <p className="note" role="alert">No se pudo aplicar el cambio. Revisá los datos y la vigencia de tu póliza o contactá a Coordinación.</p>}
  {query.actualizada === '1' && <StatusRibbon message="Inscripción actualizada." />}
  <p>Estado <strong>{statusLabels.get(entry.status) ?? entry.status}</strong></p>
  {entry.status === 'revisión' && <p>Tenés un cupo reservado. Coordinación debe confirmar tu participación.</p>}
  {entry.status === 'espera' && <p>Estás en lista de espera. Si se libera un cupo, se asigna por orden de recepción y te avisamos por correo.</p>}
  {active && entry.status === 'confirmada' && <p>Si cambiás tus fechas, la inscripción vuelve a revisión y conserva el cupo reservado.</p>}
  <PrivateRegistrationForms token={token} active={active} warning={warning} general={entry.unit === 'Voluntariado General'}
    schedule={{flexible:entry.flexible,starts:entry.first_day,ends:entry.last_day}} arrival={entry.starts} departure={entry.ends} details={entry.details}/>

  </>;
}
