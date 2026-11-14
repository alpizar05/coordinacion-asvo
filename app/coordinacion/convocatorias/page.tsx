import {collectionAccessCondition} from '../../../lib/authorization-sql';
import {ContextReturnLink} from '../navigation-context';
import { redirect } from 'next/navigation';
import { StatusRibbon } from '../../status-ribbon';
import { CollectionsTable, type CollectionRow } from '../collections-table';
import CoordinationBreadcrumb from '../breadcrumb';
import { OutingsTable, type OutingRow } from '../outings-table';
import Link from 'next/link';
import { staff, staffScope } from '../../../lib/auth';
import { registrationToday } from '../../../lib/outing-invitations';
import { sql } from '../../../lib/db';

export default async function Page({ searchParams }: { searchParams: Promise<{ creadas?: string; destacadaError?:string; error?:string }> }) {
  const { creadas, destacadaError, error } = await searchParams;
  const user = await staff();
  if (!user) redirect('/coordinacion');

  const admin = staffScope(user).admin;
  const general = staffScope(user).general;
  const scopes = staffScope(user).units;
  const operates = general || scopes.length > 0;
  if (admin && !operates) redirect('/coordinacion/administracion');
  const units = await sql`select name from units order by name`;
  const available = units.filter(unit => general || scopes.includes(unit.name));
  const outings = await sql<OutingRow[]>`select id,title,location,unit,status,listed,starts::text,ends::text from outings
    where ${general} or unit=any(${scopes}::text[]) order by starts desc`;
  const collections = operates ? await sql<CollectionRow[]>`
    with scoped_outings as (
      select id,request_id,title,starts,
        (status='abierta' and listed and coalesce(registration_deadline,starts) >= ${registrationToday}) as public
      from outings where ${general} or unit=any(${scopes}::text[])
    )
    select c.id,c.name,'manuales' as kind,count(o.id)::int as outings,
      count(*) filter (where o.public)::int as public_outings,
      (min(o.starts) filter (where o.public))::text as next_start
    from outing_collections c left join outing_collection_members m on m.collection_id=c.id
    left join scoped_outings o on o.id=m.outing_id
    where ${collectionAccessCondition(sql,user,true)}
    group by c.id
    union all
    select r.id,coalesce(r.outing_defaults->>'title',(array_agg(o.title order by o.starts,o.id))[1]),
      'automaticas',count(*)::int,count(*) filter (where o.public)::int,
      (min(o.starts) filter (where o.public))::text
    from scoped_outings o join requests r on r.id=o.request_id
    group by r.id having count(*) > 1` : [];
  return <><ContextReturnLink/>{operates && <CoordinationBreadcrumb current="Convocatorias de salida" />}<h1>{operates ? "Convocatorias de salida" : "Coordinación"}</h1>
  {error && <p className="note" role="alert">{error}</p>}
  {destacadaError && <p id="destacada" className="note" role="alert">{destacadaError}</p>}
  {!user.grants.length && <p>Tu cuenta está a la espera de permisos de ASVO.</p>}
  {!!available.length && <section className="card" id="salidas" data-navigation-list-container="outings">
    <div className="outings-table-heading">
      <Link href="#colecciones">Ver convocatorias en serie</Link>
      <Link className="button coord-button-primary" href="/coordinacion/salidas/nueva">Agregar nueva convocatoria de salida</Link>
    </div>
    {creadas && <StatusRibbon message={`Se crearon ${creadas} convocatorias.`} />}
    <OutingsTable outings={outings} />
  </section>}
  {operates && <section className="card" id="colecciones" data-navigation-list-container="series">
    <div className="outings-table-heading">
      <h2>Convocatorias en serie</h2>
      <Link className="button" href="/coordinacion/colecciones/nueva">Crear convocatoria en serie</Link>
    </div>
    <CollectionsTable collections={collections} />
  </section>}</>;
}
