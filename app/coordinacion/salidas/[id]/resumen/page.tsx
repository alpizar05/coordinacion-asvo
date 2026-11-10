import { MobileDisclosure } from '../../../mobile-disclosure';
import { readOutingReports } from '../../../../../lib/outing-report';
import { OutingReportView } from '../../../../outing-report-view';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canOperate, staff } from '../../../../../lib/auth';
import { outingBrief } from '../../../../../lib/outing-brief';
import { uuid } from '../../../../../lib/registration';
import { sql } from '../../../../../lib/db';
import CoordinationBreadcrumb from '../../../breadcrumb';
import { OutingBriefView } from '../../../../outing-brief-view';
import { ShareBrief } from './share-brief';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resumen para el 70 | ASVO', robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ informe?: string }> }) {
  const { id } = await params;
  if (!uuid(id)) notFound();
  const user = await staff();
  const [outing] = await sql`select unit,title from outings where id=${id}`;
  if (!outing || !canOperate(user,outing.unit)) notFound();
  const brief = await outingBrief(id);
  if (!brief) notFound();
  const leads = brief.people.filter(person => person.details.assigned70 === true).map(person => ({ id: String(person.id), name: String(person.name) }));
  const reports = await readOutingReports(id);
  const selectedReport = (await searchParams).informe;
  return <>
    <CoordinationBreadcrumb current="Resumen para el 70" parent={{ href: `/coordinacion/salidas/${id}`, label: outing.title }} />
    <div className="actions brief-controls"><Link className="button" href={`/coordinacion/salidas/${id}?pestana=herramientas`}>Volver a la salida</Link></div>
    <ShareBrief id={id} leads={leads} />
    <section className="card" id="informes"><h2>Informes de salida del 70</h2>
      {reports.length ? reports.map(report => <div key={report.id} id={`informe-${report.lead_registration_id}`}>{selectedReport === report.lead_registration_id && <h3>Informe de {report.lead_name}</h3>}{selectedReport === report.lead_registration_id ? <OutingReportView report={report} /> : <MobileDisclosure title={`Informe de ${report.lead_name}`}><OutingReportView report={report} /></MobileDisclosure>}</div>) : <p>Todavía no se ha presentado un informe para esta salida.</p>}
    </section>
    <OutingBriefView brief={brief} />
  </>;
}
