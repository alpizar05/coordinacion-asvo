import { OutingLogistics } from '../../outing-logistics';
import { SaveRegistrationPreferences, RememberRegistrationForm } from '../../remember-registration';
import { RegistrationResultModal } from '../../registration-result-modal';
import { readRegistrationReceipt } from '../../../lib/registration-receipt';
import { CapacitySummary } from '../../capacity-summary';
import { ShareWhatsApp } from '../../share-whatsapp';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { activeOutingInvitation, registrationToday } from '../../../lib/outing-invitations';
import { sql } from '../../../lib/db';
import { displayDate, uuid } from '../../../lib/registration';
import { Drawer } from '../../drawer';
import { RegistrationFields } from '../../fields';
import { PhotoGallery } from '../../photo-gallery';
import { register } from '../../public-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ invitacion?: string }>;
}) {
  const { id } = await params;
  if (!uuid(id)) return {};
  if ((await searchParams).invitacion) return { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
  const [outing] = await sql`select listed from outings where id=${id} and status='abierta'
    and coalesce(registration_deadline,starts) >= ${registrationToday}`;
  return outing?.listed ? {} : { robots: { index: false, follow: false } };
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ recibido?: string; fechas?: string; poliza?: string; invitacion?: string; invitacionError?: string; registroError?: string; estado?: string; resultado?: string }>;
}) {
  const { id } = await params;
  if (!uuid(id)) notFound();
  const [outing] = await sql`select o.title,o.location,o.unit,o.flexible,o.starts::text,o.ends::text,o.requirements,o.logistics,o.transport_details,o.food_details,o.lodging_details,o.request_id,
    o.capacity,(select count(*)::int from registrations where outing_id=o.id and status in ('revisión','confirmada')) as occupied,
    o.status,coalesce(o.registration_deadline,o.starts)::text as deadline,
    coalesce(o.registration_deadline,o.starts) >= ${registrationToday} as accepting,
    o.listed and exists(select 1 from outings sibling where sibling.request_id=o.request_id
      and sibling.id<>o.id and sibling.listed and sibling.status='abierta'
      and coalesce(sibling.registration_deadline,sibling.starts) >= ${registrationToday}) as has_collection
    from outings o where o.id=${id} and o.status in ('abierta','confirmada')`;
  if (!outing) notFound();
  const query = await searchParams;
  const token = typeof query.invitacion === 'string' ? query.invitacion : '';
  const invitation = token ? await activeOutingInvitation(id, token) : undefined;
  const receipt = await readRegistrationReceipt(id);
  if (!receipt && ((token && !invitation) || (!invitation && (outing.status !== 'abierta' || !outing.accepting)))) notFound();
  const photos = await sql<{ id: string; alt: string; credit: string }[]>`select id,alt,credit from outing_photos
    where outing_id=${id} and position is not null order by position`;
  const submitted = query.recibido === '1' && !!receipt;
  const receiptMessage = !receipt ? 'Consultá el estado de tu solicitud desde el correo recibido.' : receipt.status === 'espera'
    ? 'Quedaste en lista de espera. Te avisaremos por correo si se libera un cupo.'
    : 'Reservamos un cupo. Coordinación debe confirmar tu participación.';
  const errors: Record<string,string> = {
    'identificacion-invalida': 'Ingresá tu número de identificación con exactamente 9 dígitos, sin espacios ni guiones. Ejemplo: 102340567.',
    'identificacion-no-encontrada': 'No encontramos esa identificación en nuestra base de personas voluntarias. Revisá el número ingresado. Si es correcto, contactá a Coordinación para registrar o actualizar tus datos.',
    duplicada: 'Ya tenés una inscripción activa para esta salida. Usá el enlace privado de tu correo para consultarla o editarla.',
    limite: 'Se alcanzó el límite de intentos. Esperá unos minutos antes de volver a enviar.',
    'datos-invalidos': 'Revisá tu identificación y las fechas solicitadas.',
    'ficha-no-elegible': 'Revisá con Coordinación el correo registrado y la unidad a la que pertenecés.',
    'invitacion-invalida': 'Usá la identificación de la persona invitada o contactá a Coordinación.',
  };
  const schedule = `${outing.starts}/${outing.ends}/${outing.flexible}`;
  const period = `${displayDate(outing.starts)} al ${displayDate(outing.ends)}`;
  const participation = outing.flexible
    ? 'Podés apoyar uno o varios días. Para apoyar un solo día, elegí la misma fecha de llegada y regreso. Si necesitás llegar antes o salir después del periodo publicado, Coordinación debe aprobarlo.'
    : 'La inscripción cubre el periodo completo de la salida.';

  return <>
    <nav aria-label="Ubicación en el sitio" className="breadcrumb">
      <ol>
        <li><Link href="/">Convocatorias</Link></li>
        {outing.has_collection && <li><span aria-hidden="true">›</span> <Link href={`/colecciones/${outing.request_id}`}>Bloques de fechas</Link></li>}
        <li><span aria-hidden="true">›</span> <span aria-current="page">{outing.title}</span></li>
      </ol>
    </nav>
    <header className="outing-heading">
      <div className="outing-heading-top">
        <span className="eyebrow">{outing.unit}</span>
        {!invitation && <div className="actions"><ShareWhatsApp path={`/convocatorias/${id}`} message={`${outing.title} · ${period}`} /></div>}
      </div>
      <h1>{outing.title}</h1>
      <p>{outing.location}</p>
    </header>
    <div className="outing-layout">
      <aside id="inscripcion" className="card outing-summary" aria-labelledby="outing-summary">
        <h2 id="outing-summary">Resumen de la salida</h2>
        <CapacitySummary capacity={outing.capacity} occupied={outing.occupied} detail />
        <dl>
          <div><dt>Lugar</dt><dd>{outing.location}</dd></div>
          <div><dt>Fechas</dt><dd>{period}</dd></div>
          <div><dt>Fecha límite de inscripción pública</dt><dd>{displayDate(outing.deadline)}</dd></div>
          <div><dt>Modalidad</dt><dd>{outing.flexible ? 'Fechas flexibles' : 'Fechas fijas'}</dd></div>
        </dl>
        <p>{participation}</p>
        {invitation && <p>Estás usando una invitación de Coordinación.</p>}
        {query.registroError && <RegistrationResultModal key={query.resultado ?? query.registroError}
          title={query.registroError === 'identificacion-no-encontrada' ? 'Identificación no encontrada' : 'No se pudo enviar la inscripción'}
          paragraphs={[errors[query.registroError] ?? 'No se pudo recibir la inscripción. Revisá los datos.']} />}
        {query.invitacionError === '1' && <RegistrationResultModal key={query.resultado} title="Revisá la invitación"
          paragraphs={['Usá la identificación de la persona invitada. Si el problema continúa, contactá a Coordinación.']} />}
        {query.poliza === '1' && <RegistrationResultModal key={query.resultado} title="No encontramos una póliza vigente"
          paragraphs={['No encontramos una póliza vigente que cubra todas las fechas de participación. Contactá a Coordinación para actualizar tu póliza y volver a inscribirte.']} />}
        {query.fechas === '1' && <RegistrationResultModal key={query.resultado} title="Las fechas de la salida cambiaron"
          paragraphs={['Revisá las fechas y la modalidad antes de volver a enviar tu inscripción.']} />}
        {submitted && <>
          <SaveRegistrationPreferences outingId={id} />
          <RegistrationResultModal key={query.resultado ?? 'recibido'} success title="Inscripción recibida"
            greeting={receipt?.firstName?.trim() ? `¡Gracias, ${receipt.firstName.trim()}!` : '¡Gracias!'}
            paragraphs={['Recibimos tu solicitud de inscripción.',
              receiptMessage,
              'Estarás recibiendo un correo con el estado de tu solicitud de inscripción y un enlace privado para consultarla, editarla o cancelarla.']} />
        </>}
        {(invitation || (outing.status === 'abierta' && outing.accepting)) &&
          <Drawer label={outing.occupied >= outing.capacity ? 'Enviar solicitud' : 'Inscribirme'} title="Inscripción a la salida" className="registration-drawer">
            <p><strong>{outing.title}</strong><br />{period}</p>
            <CapacitySummary capacity={outing.capacity} occupied={outing.occupied} detail />
            <p>Coordinación debe confirmar tu participación{outing.occupied >= outing.capacity ? '. Los cupos están cubiertos; tu inscripción se recibirá en lista de espera.' : '.'}</p>
            <p>{participation}</p>
            <RememberRegistrationForm outingId={id} action={register.bind(null, id, schedule, token)}>
              <label>Número de identificación<input name="identification" type="text" inputMode="numeric" required minLength={9} maxLength={9} pattern="[0-9]{9}" placeholder="102340567" title="Ingresá 9 dígitos, sin espacios ni guiones. Ejemplo: 102340567." aria-describedby="identification-help" autoComplete="off" /><span id="identification-help" className="muted">9 dígitos, sin espacios ni guiones. Ejemplo: 102340567.</span></label>
              <RegistrationFields flexible={outing.flexible} general={outing.unit === 'Voluntariado General'}
                starts={outing.starts} ends={outing.ends} />
            </RememberRegistrationForm>
          </Drawer>}
      </aside>
      <div className="outing-details">
        <PhotoGallery photos={photos} invitation={token} />
        <section className="card"><h2>Requisitos</h2><p className="copy">{outing.requirements || 'Consultá los requisitos con coordinación.'}</p></section>
        <section className="card"><h2>Logística</h2><OutingLogistics outing={outing} /><>{outing.logistics && <><h3>Otras indicaciones</h3><p className="copy">{outing.logistics}</p></>}</></section>
      </div>
    </div>
  </>;
}
