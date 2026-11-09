import CoordinationBreadcrumb from '../breadcrumb';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canAdminister, canOperate, staff } from '../../../lib/auth';
import { sql } from '../../../lib/db';
import { Importer, PolicyImporter } from './importer';

export default async function Volunteers() {
  const user = await staff();
  const admin = canAdminister(user);
  if (!admin && !canOperate(user)) notFound();
  const people = await sql`
    select id,identification,name,surname,second_surname,email,units
    from volunteers order by name,surname,second_surname,id`;
  return <>
    <CoordinationBreadcrumb current="Voluntariado" />
    <h1>Voluntariado</h1>
    <section className="card">
      <h2>Registro maestro</h2>
      <p>{people.length} {people.length === 1 ? 'persona voluntaria' : 'personas voluntarias'}</p>
      <div className="outings-scroll" tabIndex={0} role="region" aria-label="Tabla de voluntariado">
        <table className="outings-table">
          <thead><tr>
            <th scope="col">Nombre</th><th scope="col">Identificación</th>
            <th scope="col">Correo</th><th scope="col">Unidades</th>
          </tr></thead>
          <tbody>
            {people.map(person => <tr key={person.id}>
              <th scope="row"><Link href={`/coordinacion/registro/${person.id}`}>
                {person.name} {person.surname} {person.second_surname}
              </Link></th>
              <td>{person.identification}</td><td>{person.email || 'Pendiente'}</td>
              <td>{person.units.join(', ') || 'Pendientes'}</td>
            </tr>)}
            {!people.length && <tr><td colSpan={4}>Todavía no hay personas voluntarias registradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    {admin && <><Importer /><PolicyImporter /></>}
  </>;
}
