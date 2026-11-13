import {RegistryForm} from '../registry-form';
import {FormField,FormFieldGroup} from '../../form-feedback/form-feedback';
import { SectionWorkspace } from '../section-workspace';
import { notFound, redirect } from 'next/navigation';
import { canAdminister, staff } from '../../../lib/auth';
import { demo, sql } from '../../../lib/db';
import { grant } from '../../actions/administration';
import CoordinationBreadcrumb from '../breadcrumb';
import { Importer, PolicyImporter } from '../registro/importer';
import { StatusRibbon } from '../../status-ribbon';

export default async function Administration({ searchParams }: {
  searchParams: Promise<{ permisos?: string; registro?: string; polizas?: string }>;
}) {
  const user = await staff();
  if (!user) redirect('/coordinacion');
  if (!canAdminister(user)) notFound();
  const [units,grants] = await Promise.all([
    sql`select name from units order by name`,
    sql`select * from grants order by subject,role,unit`,
  ]);
  const result = await searchParams;
  const message = result.permisos === '1' ? 'Se procesó la gestión de permisos.'
    : result.registro === '1' ? 'Importación del registro aplicada.'
    : result.polizas === '1' ? 'Conciliación de pólizas aplicada.' : '';
  return <>
    <CoordinationBreadcrumb current="Administración" />
    <h1>Administración</h1>
    <p>Gestioná los accesos del personal y las importaciones del registro.</p>
    {message && <StatusRibbon message={message} />}
    <SectionWorkspace initial={result.registro==='1'?'volunteers':result.polizas==='1'?'policies':'access'} sections={[
      {key:'access',label:'Accesos del personal',content:<section className="card" aria-labelledby="accesos-personal">
      <h2 id="accesos-personal">Accesos del personal</h2>
      <ul>{grants.map(row => <li key={row.subject+row.role+row.unit}>{row.subject} · {row.role} {row.unit}</li>)}</ul>
      <RegistryForm kind="grant" action={grant} successMessage="Permisos actualizados.">
        <FormField name="subject" label="Identificador de objeto Entra"><input name="subject" defaultValue={demo ? 'local-coordination' : undefined} required /></FormField>
        <FormField name="role" label="Rol"><select name="role"><option value="general">Coordinación general</option><option value="unidad">Coordinación de unidad</option><option value="admin">Administración de permisos</option></select></FormField>
        <FormField name="unit" label="Unidad para coordinación de unidad"><select name="unit">{units.map(unit => <option key={unit.name}>{unit.name}</option>)}</select></FormField>
        <FormFieldGroup name="action" label="Acción de permiso"><div className="actions"><button name="action" value="asignar">Asignar</button><button name="action" value="revocar">Revocar</button></div></FormFieldGroup>
      </RegistryForm>
    </section>},
      {key:'volunteers',label:'Importar voluntariado',content:<Importer />},
      {key:'policies',label:'Conciliar pólizas',content:<PolicyImporter />},
    ]}/>
  </>;
}
