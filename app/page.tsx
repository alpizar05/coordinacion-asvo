import { ConvocationsGrid } from './convocations-grid';
import { CapacitySummary } from './capacity-summary';
import Image from 'next/image';
import Link from 'next/link';
import forestHero from '../public/hero-bosque-asvo.webp';
import { homepageFeature } from '../lib/homepage-feature';
import { listedOutings, publicCollectionMembers } from '../lib/catalog';
import { displayDate } from '../lib/registration';
import { OutingCard } from './outing-card';

export const dynamic = 'force-dynamic';
export default async function Home() {
  const [outings, selection, members] = await Promise.all([listedOutings(), homepageFeature(), publicCollectionMembers()]);
  const groups = new Map<string, (typeof outings)[number][]>();
  for (const outing of outings) {
    const group = groups.get(outing.request_id);
    if (group) group.push(outing);
    else groups.set(outing.request_id, [outing]);
  }
  const selectedBlock = outings.find(outing => outing.id === selection?.outing_id);
  const selectedGroup = selection?.request_id ? groups.get(selection.request_id) : undefined;
  const featuredGroup = selectedBlock ? [selectedBlock] : selectedGroup ?? groups.values().next().value;
  const featured = featuredGroup?.[0];
  const featuredDates = featuredGroup?.length ?? 0;
  const featureCollection = featuredDates > 1;
  type CatalogCard = {
    outing: (typeof outings)[number];
    periods: number;
    collection?: { href: string; title: string };
  };
  const cards: CatalogCard[] = outings.map(outing => ({ outing, periods: 1 }));
  for (const group of groups.values()) {
    const outing = group[0];
    if (group.length > 1) cards.push({
      outing,
      periods: group.length,
      collection: { href: `/colecciones/${outing.request_id}`, title: outing.general_title ?? outing.title },
    });
  }
  const byId = new Map(outings.map(outing => [outing.id, outing]));
  const manual = new Map<string, CatalogCard>();
  for (const member of members) {
    const outing = byId.get(member.outing_id);
    if (!outing) continue;
    const existing = manual.get(member.id);
    if (existing) existing.periods++;
    else manual.set(member.id, {
      outing, periods: 1,
      collection: { href: `/colecciones/manuales/${member.id}`, title: member.name },
    });
  }
  cards.push(...Array.from(manual.values()).filter(card => card.periods > 1));
  cards.sort((a, b) => a.outing.starts.localeCompare(b.outing.starts)
    || (a.collection?.title ?? a.outing.title).localeCompare(b.collection?.title ?? b.outing.title, 'es'));
  return <>
    <section className="home-hero" aria-labelledby="home-title">
      <Image className="home-hero-image" src={forestHero} preload
        alt="Montañas cubiertas de bosque entre nubes"
        sizes="(max-width: 1680px) 100vw, 1600px" />
      <div className="home-hero-copy">
        <span className="eyebrow">Voluntariado ambiental · Costa Rica</span>
        <h1 id="home-title">Sumate a una salida de ASVO</h1>
        <p>Encontrá tu próxima oportunidad para apoyar la conservación.</p>
      </div>
    </section>

    {featured && <section id="convocatorias" className={`home-featured${featured.photo_id ? ' home-featured-with-photo' : ''}`} aria-labelledby="featured-title">
      <div className="home-featured-copy">
        <span className="eyebrow">Salida destacada</span>
        <h2 id="featured-title">{featureCollection ? featured.general_title ?? featured.title : featured.title}</h2>
        <p>{featured.location} · {featured.unit}</p>
        <p><strong>{displayDate(featured.starts)}{featured.ends !== featured.starts && ` al ${displayDate(featured.ends)}`}</strong>
          {featuredDates > 1 && ` · ${featuredDates} fechas disponibles`}
          {featured.flexible && ' · Fechas flexibles'}
        </p>
        {featureCollection ? <p>Cupos por fecha</p>
          : <CapacitySummary capacity={featured.capacity} occupied={featured.occupied} />}
        <Link className="button home-featured-link"
          href={featureCollection ? `/colecciones/${featured.request_id}` : `/convocatorias/${featured.id}`}>
          Ver salida <span aria-hidden="true">›</span>
        </Link>
      </div>
      {featured.photo_id && <img className="home-featured-photo" src={`/api/fotos/${featured.photo_id}`}
        alt={featured.alt ?? ''} loading="lazy" />}
    </section>}

    {cards.length > 0 ? <ConvocationsGrid>
        {cards.map(card => <OutingCard key={card.collection?.href ?? card.outing.id} {...card} />)}
    </ConvocationsGrid> : !featured && <section aria-labelledby="convocatorias">
      <h2 id="convocatorias">Convocatorias abiertas</h2>
      <p>Por el momento no hay convocatorias abiertas.</p>
    </section>}
  </>;
}
