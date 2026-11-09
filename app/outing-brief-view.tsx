import { outingBrief } from '../lib/outing-brief';
import { displayDate } from '../lib/registration';
import { registrationLogistics } from '../lib/registration-logistics';

export function OutingBriefView({ brief }: { brief: NonNullable<Awaited<ReturnType<typeof outingBrief>>> }) {
  const { outing, people } = brief;
  const participants = people.map(person => ({ ...person, logistics: registrationLogistics(person.details) }));
  const leads = participants.filter(person => person.details.assigned70 === true);
  const transport = participants.filter(person => person.logistics.transport);
  const food = participants.filter(person => person.logistics.food);
  const seats = transport.reduce((total, person) => total + person.logistics.seats, 0);
  return <article className="outing-brief">
    <header className="card">
      <p className="eyebrow">Resumen de salida · Para el 70</p>
      <h1>{outing.title}</h1>
      <dl className="profile-facts">
        <div><dt>Lugar</dt><dd>{outing.location}</dd></div>
        <div><dt>Unidad</dt><dd>{outing.unit}</dd></div>
        <div><dt>Fechas</dt><dd>{displayDate(outing.starts)} al {displayDate(outing.ends)}</dd></div>
        <div><dt>Modalidad</dt><dd>{outing.flexible ? 'Fechas flexibles' : 'Fechas fijas'}</dd></div>
        <div><dt>Estado de la salida</dt><dd>{outing.status}</dd></div>
        <div><dt>70 asignado</dt><dd>{leads.map(person => person.name).join(', ') || 'Pendiente de asignar'}</dd></div>
      </dl>
      <p><strong>{participants.length} personas confirmadas · {seats} espacios de transporte ofrecidos</strong></p>
      <p className="muted">Solo incluye inscripciones confirmadas. La información se actualiza al abrir o recargar esta página.</p>
    </header>
    <section className="card"><h2>Preparación y logística</h2>
      <h3>Requisitos</h3><p className="copy">{outing.requirements || 'Sin requisitos registrados. Consultá a Coordinación.'}</p>
      <h3>Logística de la salida</h3><p className="copy">{outing.logistics || 'Sin logística registrada. Consultá a Coordinación.'}</p>
    </section>
    <section className="card"><h2>Personas confirmadas</h2>
      <div className="outings-scroll" tabIndex={0} role="region" aria-label="Personas confirmadas y fechas de participación">
        <table className="outings-table"><thead><tr><th>Persona voluntaria</th><th>Contacto</th><th>Llegada</th><th>Regreso</th><th>Póliza</th></tr></thead>
          <tbody>{participants.map(person => <tr key={person.id}>
            <th scope="row">{person.name}{person.details.assigned70 === true && <> <span className="pill coord-role-label">70</span></>}</th>
            <td>{person.whatsapp || 'No registrado'}</td><td>{displayDate(person.starts)}</td><td>{displayDate(person.ends)}</td><td>{person.covered ? 'Vigente para sus fechas' : 'Consultar a Coordinación'}</td>
          </tr>)}{!participants.length && <tr><td colSpan={5}>No hay personas confirmadas.</td></tr>}</tbody>
        </table>
      </div>
    </section>
    <section className="card"><h2>Transporte</h2>
      {transport.length ? <><p>{transport.length} {transport.length === 1 ? 'persona con vehículo propio' : 'personas con vehículo propio'} · {seats} espacios ofrecidos para acompañantes.</p>
        <div className="outings-scroll" tabIndex={0} role="region" aria-label="Transporte ofrecido"><table className="outings-table"><thead><tr><th>Persona voluntaria</th><th>Personas que puede llevar</th><th>Participación</th></tr></thead><tbody>{transport.map(person => <tr key={person.id}><th scope="row">{person.name}</th><td>{person.logistics.legacySeats ? 'Cantidad no indicada' : person.logistics.seats}</td><td>{displayDate(person.starts)} al {displayDate(person.ends)}</td></tr>)}</tbody></table></div>
        <p className="muted">Los espacios son ofrecimientos; los traslados deben coordinarse. Las ofertas sin cantidad no se suman al total.</p>
      </> : <p>Nadie indicó transporte propio.</p>}
    </section>
    <section className="card"><h2>Alimentación</h2>
      {food.length ? <ul className="brief-notes">{food.map(person => <li key={person.id}><strong>{person.name}</strong><p className="copy">{person.logistics.food}</p></li>)}</ul> : <p>No se indicaron restricciones alimentarias entre las personas confirmadas.</p>}
    </section>
    <section className="card"><h2>Observaciones para esta salida</h2>
      {participants.some(person => person.logistics.other) ? <ul className="brief-notes">{participants.filter(person => person.logistics.other).map(person => <li key={person.id}><strong>{person.name}</strong><p className="copy">{person.logistics.other}</p></li>)}</ul> : <p>No se indicaron observaciones.</p>}
    </section>
    <p className="muted brief-confidential">Uso exclusivo para coordinar esta salida. No compartás este resumen fuera del equipo responsable.</p>
  </article>;
}
