import { OutingLogistics } from './outing-logistics';
import Link from 'next/link';
import { outingBrief } from '../lib/outing-brief';
import { displayDate } from '../lib/registration';
import { registrationLogistics } from '../lib/registration-logistics';
import { BriefRefresh } from './brief-refresh';

function WhatsApp({ value }: { value: string | null }) {
  if (!value) return <span className="muted">Sin contacto registrado</span>;
  let number = value.replace(/\D/g,'');
  if (number.length === 8) number = `506${number}`;
  return /^\d{10,15}$/.test(number)
    ? <a href={`https://wa.me/${number}`} target="_blank" rel="noopener noreferrer">WhatsApp · {value}</a>
    : <span>{value}</span>;
}

export function OutingBriefView({ brief, leadRegistrationId, report }: {
  brief: NonNullable<Awaited<ReturnType<typeof outingBrief>>>;
  leadRegistrationId?: string;
  report?: { href: string; submitted: boolean; draft?: boolean };
}) {
  const { outing, people } = brief;
  const participants = people.map(person => ({ ...person, logistics: registrationLogistics(person.details) }));
  const leads = participants.filter(person => person.details.assigned70 === true);
  const transport = participants.filter(person => person.logistics.transport);
  const food = participants.filter(person => person.logistics.food);
  const seats = transport.reduce((total, person) => total + person.logistics.seats, 0);
  const lead = leads.find(person => person.id === leadRegistrationId);
  const updated = new Intl.DateTimeFormat('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'short',timeStyle:'short'}).format(new Date());
  return <article className="outing-brief">
    <header className="card brief-overview">
      <p className="eyebrow">Tu guía de salida · 70</p>
      <h1>{outing.title}</h1>
      <p className="brief-place">{outing.location}</p>
      <p><strong>{displayDate(outing.starts)} al {displayDate(outing.ends)}</strong> · {outing.unit}</p>
      <p className="muted">{outing.flexible ? 'Fechas flexibles' : 'Fechas fijas'} · {outing.status}</p>
      <p><strong>{lead ? 'Tu asignación como 70:' : '70 asignado:'}</strong> {lead?.name || leads.map(person => person.name).join(', ') || 'Pendiente de asignar'}</p>
      <div className="brief-summary" aria-label="Resumen de preparación">
        <a href="#brief-participantes"><strong>{participants.length}</strong><span>{participants.length === 1 ? 'participante confirmado' : 'participantes confirmados'}</span></a>
        <a href="#brief-transporte"><strong>{seats}</strong><span>{seats === 1 ? 'espacio de transporte ofrecido' : 'espacios de transporte ofrecidos'}</span></a>
        <a href="#brief-alimentacion"><strong>{food.length}</strong><span>{food.length === 1 ? 'persona con restricciones indicadas' : 'personas con restricciones indicadas'}</span></a>
      </div>
      <div className="brief-update"><p className="muted">Actualizado: {updated} · Costa Rica</p><BriefRefresh /></div>
    </header>
    <nav className="brief-jump-links" aria-label="Secciones de la guía de salida">
      <a href="#brief-participantes">Participantes</a><a href="#brief-transporte">Transporte</a><a href="#brief-alimentacion">Alimentación</a>
      <a href="#brief-indicaciones">Indicaciones</a>{report && <a href="#brief-informe">Informe</a>}
    </nav>
    <section className="card" id="brief-participantes" aria-labelledby="brief-participantes-title"><h2 id="brief-participantes-title">Participantes confirmados</h2>
      <p className="muted">La lista refleja inscripciones confirmadas. La asistencia real se confirma en el informe.</p>
      <div className="brief-roster-region" role="region" aria-label="Participantes y fechas de participación" tabIndex={0}>
        <table className="brief-roster" role="table"><thead><tr><th scope="col">Persona voluntaria</th><th scope="col">Participación</th><th scope="col">Contacto</th></tr></thead>
          <tbody>{participants.map(person => {
            const differentDates = person.starts !== outing.starts || person.ends !== outing.ends;
            return <tr key={person.id}>
              <th scope="row">{person.name}{person.details.assigned70 === true && <span className="pill brief-role">{person.id === leadRegistrationId ? 'Vos · 70' : '70'}</span>}</th>
              <td className="brief-participation"><span>{displayDate(person.starts)} al {displayDate(person.ends)}</span>
                {differentDates && <span className="brief-date-note">Fechas distintas al periodo general</span>}
                {!person.covered && <span className="brief-date-note">Consultar póliza con Coordinación</span>}</td>
              <td className="brief-contact"><WhatsApp value={person.whatsapp} /></td>
            </tr>;
          })}</tbody>
        </table>
        {!participants.length && <p>No hay personas confirmadas.</p>}
      </div>
    </section>
    <section className="card" id="brief-transporte" aria-labelledby="brief-transporte-title"><h2 id="brief-transporte-title">Transporte</h2>
      <p className="copy">{outing.transport_details || 'Transporte de la salida: por confirmar con Coordinación.'}</p>
      {transport.length ? <><p><strong>{seats} espacios ofrecidos</strong> · {transport.length} {transport.length === 1 ? 'persona con transporte propio' : 'personas con transporte propio'}</p>
        <ul className="brief-transport-list">{transport.map(person => <li key={person.id}>
          <strong>{person.name}</strong><p>{person.logistics.legacySeats ? 'Ofreció transporte sin indicar cantidad' : `Puede llevar ${person.logistics.seats} ${person.logistics.seats === 1 ? 'persona' : 'personas'}`}</p>
          <p className="muted">Participa del {displayDate(person.starts)} al {displayDate(person.ends)}</p><WhatsApp value={person.whatsapp} />
        </li>)}</ul>
        <p className="muted">Los espacios son ofrecimientos; todavía no representan una distribución de pasajeros acordada. Las ofertas sin cantidad no se suman al total.</p>
      </> : <p>No hay transporte propio registrado entre las personas confirmadas.</p>}
    </section>
    <section className="card" id="brief-alimentacion" aria-labelledby="brief-alimentacion-title"><h2 id="brief-alimentacion-title">Alimentación</h2>
      <p className="copy">{outing.food_details || 'Alimentación de la salida: por confirmar con Coordinación.'}</p>
      <h3>Restricciones indicadas por participantes</h3>
      {food.length ? <ul className="brief-notes">{food.map(person => <li key={person.id}><strong>{person.name}</strong><p className="copy">{person.logistics.food}</p></li>)}</ul> : <p>Sin restricciones alimentarias indicadas entre las personas confirmadas.</p>}
    </section>
    <section className="card" id="brief-indicaciones" aria-labelledby="brief-indicaciones-title"><h2 id="brief-indicaciones-title">Indicaciones y logística</h2>
      <h3>Requisitos</h3><p className="copy">{outing.requirements || 'Sin requisitos registrados. Consultá a Coordinación.'}</p>
      <OutingLogistics outing={outing} fields={['lodging_details']} /><h3>Otras indicaciones</h3><p className="copy">{outing.logistics || 'Sin otras indicaciones registradas.'}</p>
      {participants.some(person => person.logistics.other) && <><h3>Observaciones para esta salida</h3>
        <ul className="brief-notes">{participants.filter(person => person.logistics.other).map(person => <li key={person.id}><strong>{person.name}</strong><p className="copy">{person.logistics.other}</p></li>)}</ul></>}
    </section>
    {report && <section className="card brief-report-callout" id="brief-informe"><h2>Informe de salida</h2>
      <p>{report.submitted ? 'Tu informe está finalizado. Podés consultarlo; la edición está bloqueada.' : report.draft ? 'Tenés un borrador guardado. Retomalo para completar y finalizar el informe.' : 'Describí las labores realizadas y confirmá quiénes participaron realmente.'}</p>
      <Link className="button" href={report.href}>{report.submitted ? 'Consultar informe' : report.draft ? 'Continuar borrador' : 'Completar informe de salida'}</Link>
    </section>}
    <p className="muted brief-confidential">Uso exclusivo para coordinar esta salida. El enlace es personal y permite consultar datos de participantes. No lo compartás fuera del equipo responsable.</p>
  </article>;
}
