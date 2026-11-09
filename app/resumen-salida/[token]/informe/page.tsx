import { reportDefaults, labourOptions, activityOptions } from '../../../../lib/outing-report-options';
import Link from 'next/link';
import { briefAccess, outingBrief } from '../../../../lib/outing-brief';
import { readOutingReports } from '../../../../lib/outing-report';
import { sql } from '../../../../lib/db';
import { ReportForm } from './report-form';
import { OutingReportView } from '../../../outing-report-view';
import { StatusRibbon } from '../../../status-ribbon';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Informe de salida del 70 | ASVO', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function Page({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ enviado?: string; editar?: string }>;
}) {
  const { token } = await params;
  const access = await briefAccess(token);
  if (!access) return <section className="card"><h1>Informe no disponible</h1><p>El enlace venció, fue revocado o tu asignación de 70 cambió. Pedile a Coordinación un enlace actualizado.</p></section>;
  const brief = await outingBrief(access.outing_id);
  if (!brief) return null;
  const [lead] = await sql`select concat_ws(' ',v.name,v.surname,v.second_surname) as name,v.email
    from registrations r join volunteers v on v.id=r.volunteer_id where r.id=${access.lead_registration_id}`;
  const reports = await readOutingReports(access.outing_id);
  const report = reports.find(item => item.lead_registration_id === access.lead_registration_id);
  const defaults = reportDefaults(String(brief.outing.unit));
  const savedLabour = report ? report.labour_types.length ? report.labour_types : labourOptions.filter(option => option === report.labour) : defaults.labour;
  const query = await searchParams;
  const editing = !report || query.editar === '1';
  return <div className="outing-report-page">
    <Link href={`/resumen-salida/${token}`}>‹ Volver al resumen de la salida</Link>
    <h1>Informe de salida</h1><p>{brief.outing.title}</p>
    {query.enviado === '1' && <StatusRibbon message="Informe recibido. Coordinación ya puede consultarlo." />}
    {editing ? <ReportForm token={token} lead={{ name: String(lead.name), email: String(lead.email || '') }}
      initial={{ labour: savedLabour, location: report?.location ?? brief.outing.location,
        activity: report ? activityOptions.find(option => option === report.activity) ?? '' : defaults.activity, starts: report?.starts ?? brief.outing.starts, ends: report?.ends ?? brief.outing.ends,
        actions: report?.actions ?? '', host: report?.host ?? '', observations: report?.observations ?? '' }}
      participants={brief.people.map(person => ({ id: person.id, name: person.name }))}
      selected={report?.participants.filter(person => person.attended && brief.people.some(current => current.id === person.id)).map(person => person.id)} />
      : <section className="card"><h2>Informe presentado</h2><OutingReportView report={report} /><Link className="button" href={`/resumen-salida/${token}/informe?editar=1`}>Editar informe</Link></section>}
  </div>;
}
