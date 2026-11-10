import { VolunteerFilters } from './volunteer-filters';
import { searchVolunteers, volunteerListUrl } from '../../../lib/volunteer-search';
import CoordinationBreadcrumb from '../breadcrumb';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canAdminister, canOperate, staff } from '../../../lib/auth';
import { sql } from '../../../lib/db';

export default async function Volunteers({ searchParams }: { searchParams: Promise<{ buscar?: string; unidad?: string; pagina?: string }> }) {
  const user = await staff();
  const admin = canAdminister(user);
  if (!admin && !canOperate(user)) notFound();
  const params = await searchParams;
  const query = typeof params.buscar === 'string' ? params.buscar.trim().slice(0,120) : '';
  const units = (await sql<{name: string}[]>`select name from units order by name`).map(row => row.name);
  const unit = typeof params.unidad === 'string' && units.includes(params.unidad) ? params.unidad : '';
  const { people,total,page,pages,pageSize } = await searchVolunteers(query,unit,Number(params.pagina || 1));
  const filtered = !!(query || unit);
  return <>
    <CoordinationBreadcrumb current="Voluntariado" />
    <h1>Voluntariado</h1>
    <section className="card">
      <div className="outings-table-heading volunteer-registry-heading">
        <h2>Registro maestro</h2><div id="volunteer-registry-reset" />
      </div>
      <div className="coordination-table-toolbar">
        <VolunteerFilters query={query} unit={unit} units={units} />
        <p role="status">{total > pageSize ? `${(page-1)*pageSize+1}–${Math.min(page*pageSize,total)} de ${total}` : total} {total === 1 ? 'persona voluntaria' : 'personas voluntarias'}</p>
      </div>
      <div id="volunteer-registry-active-filters" />
      <div className="outings-scroll" tabIndex={0} role="region" aria-label="Tabla de voluntariado">
        <table className="outings-table coordination-compact-table compact-volunteers">
          <thead><tr>
            <th scope="col">Nombre</th><th scope="col">Identificación</th>
            <th scope="col">Correo</th><th scope="col">Unidades</th>
          </tr></thead>
          <tbody>
            {people.map(person => <tr key={person.id}>
              <th scope="row"><Link href={`/coordinacion/registro/${person.id}`}>
                {person.name} {person.surname} {person.second_surname}
              </Link></th>
              <td data-label="Identificación">{person.identification}</td><td data-label="Correo">{person.email || 'Pendiente'}</td>
              <td data-label="Unidades">{person.units.join(', ') || 'Pendientes'}</td>
            </tr>)}
            {!people.length && <tr><td colSpan={4}>{filtered ? 'No hay personas que coincidan con la búsqueda y la unidad seleccionada.' : 'Todavía no hay personas voluntarias registradas.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <nav className="volunteer-pagination" aria-label="Páginas del registro de voluntariado">
        {page>1 ? <Link href={volunteerListUrl(query,unit,page-1)} scroll={false}>Anterior</Link> : <span aria-disabled="true">Anterior</span>}
        <span aria-current="page">Página {page} de {pages}</span>
        {page<pages ? <Link href={volunteerListUrl(query,unit,page+1)} scroll={false}>Siguiente</Link> : <span aria-disabled="true">Siguiente</span>}
      </nav>}
    </section>
  </>;
}
