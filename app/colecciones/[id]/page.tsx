import { ShareWhatsApp } from '../../share-whatsapp';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listedOutings } from '../../../lib/catalog';
import { sql } from '../../../lib/db';
import { uuid } from '../../../lib/registration';
import { OutingCard } from '../../outing-card';

export const dynamic = 'force-dynamic';

export default async function Collection({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid(id)) notFound();
  const outings = await listedOutings(id);
  const first = outings[0];
  if (!first) notFound();
  const [request] = await sql`select outing_defaults->>'title' as title from requests where id=${id}`;
  const title = request?.title ?? first.title;

  return <>
    <nav className="breadcrumb" aria-label="Ubicación en el sitio">
      <ol>
        <li><Link href="/#convocatorias">Convocatorias</Link></li>
        <li><span aria-hidden="true">›</span> <span aria-current="page">{title}</span></li>
      </ol>
    </nav>
    <header className="outing-heading collection-content">
      <div className="outing-heading-top">
        <span className="eyebrow">Colección de salidas</span>
        <div className="actions"><ShareWhatsApp path={`/colecciones/${id}`} message={title} /></div>
      </div>
      <h1>{title}</h1>
      <p>Elegí el bloque de fechas para ver los detalles e inscribirte.</p>
    </header>
    <h2>Bloques de fechas</h2>
    <div className="grid">{outings.map(outing => <OutingCard key={outing.id} outing={outing} />)}</div>
  </>;
}
