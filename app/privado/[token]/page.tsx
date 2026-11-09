import { StatusRibbon } from '../../status-ribbon';
import { statusLabels } from '../../coordinacion/registration-statuses';
import { sql } from '../../../lib/db';
import { cancellationWarning, digest, displayDate } from '../../../lib/registration';
import { RegistrationFields } from '../../fields';
import { privateAction } from '../../public-actions';

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
  {active && <form className="card" action={privateAction.bind(null,token)}><h2>Editar inscripción</h2>{entry.flexible && <p>Para apoyar un solo día, elegí la misma fecha de llegada y regreso. Las fechas fuera del rango publicado requieren aprobación de Coordinación.</p>}<RegistrationFields flexible={entry.flexible} general={entry.unit === 'Voluntariado General'} starts={entry.first_day} ends={entry.last_day} details={entry.details} arrival={entry.starts} departure={entry.ends}/><button name="action" value="editar">Guardar cambios</button></form>}
  {active && entry.status === 'confirmada' && <p>Si cambiás tus fechas, la inscripción vuelve a revisión y conserva el cupo reservado.</p>}
  {active && <form className="card" action={privateAction.bind(null,token)}>{warning && <label className="note"><input type="checkbox" name="acknowledge" required/> Entiendo que deberé cubrir los gastos ya incurridos según el reglamento.</label>}<label>Motivo de la cancelación<textarea name="reason" required maxLength={2000} /></label><button name="action" value="cancelar">Cancelar mi inscripción</button></form>}
  </>;
}
