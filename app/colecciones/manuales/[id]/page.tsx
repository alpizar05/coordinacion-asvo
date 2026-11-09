import { ShareWhatsApp } from '../../../share-whatsapp';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listedOutings } from '../../../../lib/catalog';
import { sql } from '../../../../lib/db';
import { uuid } from '../../../../lib/registration';
import { OutingCard } from '../../../outing-card';
import { ShareCollection } from './share-collection';

export const dynamic = 'force-dynamic';

export default async function ManualCollection({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid(id)) notFound();
  const [collection] = await sql`select name,description from outing_collections where id=${id}`;
  if (!collection) notFound();
  const outings = await listedOutings(undefined, id);
  return <>
    <nav className="breadcrumb" aria-label="Ubicación en el sitio">
      <ol>
        <li><Link href="/#convocatorias">Convocatorias</Link></li>
        <li><span aria-hidden="true">›</span> <span aria-current="page">{collection.name}</span></li>
      </ol>
    </nav>
    <header className="outing-heading collection-content">
      <div className="outing-heading-top">
        <span className="eyebrow">Colección de salidas</span>
        <div className="actions">
          <ShareWhatsApp path={`/colecciones/manuales/${id}`} message={collection.name} />
          <ShareCollection />
        </div>
      </div>
      <h1>{collection.name}</h1>
      {collection.description && <p>{collection.description}</p>}
    </header>
    <h2>Salidas disponibles</h2>
    {outings.length ? <div className="grid">
      {outings.map(outing => <OutingCard key={outing.id} outing={outing} />)}
    </div> : <p>Por el momento no hay salidas públicas abiertas en esta colección.</p>}
  </>;
}
