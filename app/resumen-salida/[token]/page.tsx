import { readOutingReports } from '../../../lib/outing-report';
import { notFound } from 'next/navigation';
import { briefAccess, outingBrief } from '../../../lib/outing-brief';
import { OutingBriefView } from '../../outing-brief-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resumen privado de salida | ASVO', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await briefAccess(token);
  if (!access) return <section className="card"><h1>Resumen no disponible</h1><p>Este enlace venció, fue revocado o la asignación de 70 cambió. Pedile a Coordinación un enlace actualizado.</p></section>;
  const brief = await outingBrief(access.outing_id);
  if (!brief) notFound();
  const ownReport = (await readOutingReports(access.outing_id)).find(report => report.lead_registration_id === access.lead_registration_id);
  return <OutingBriefView brief={brief} leadRegistrationId={access.lead_registration_id}
    report={{ href: `/resumen-salida/${token}/informe`, submitted: ownReport?.status === 'finalizado', draft: ownReport?.status === 'borrador' }} />;
}
