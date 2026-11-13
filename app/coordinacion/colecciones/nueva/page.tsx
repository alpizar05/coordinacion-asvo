import { notFound, redirect } from 'next/navigation';
import { canOperate, staff, staffScope } from '../../../../lib/auth';
import { sql } from '../../../../lib/db';
import CoordinationBreadcrumb from '../../breadcrumb';
import type { OutingRow } from '../../outings-table';
import { CollectionForm } from './collection-form';

export default async function NewCollection() {
  const user = await staff();
  if (!user) redirect('/coordinacion');
  const general = canOperate(user);
  const scopes = staffScope(user).units;
  if (!general && !scopes.length) notFound();
  const outings = await sql<OutingRow[]>`
    select id,title,location,unit,status,listed,starts::text,ends::text from outings
    where ${general} or unit=any(${scopes}::text[]) order by starts desc,title,id`;

  return <>
    <CoordinationBreadcrumb current="Crear convocatoria en serie" parent={{ href: '/coordinacion/convocatorias#colecciones', label: 'Convocatorias de salida' }} />
    <h1>Crear convocatoria en serie</h1>
    <p>Agrupá salidas existentes. En la serie pública solo se muestran las convocatorias abiertas y públicas.</p>
    <CollectionForm outings={outings} />
  </>;
}
