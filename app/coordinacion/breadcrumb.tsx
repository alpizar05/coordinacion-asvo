import Link from 'next/link';

export default function CoordinationBreadcrumb({ current, parent, parents }: {
  current: string;
  parents?: { href: string; label: string }[];
  parent?: { href: string; label: string };
}) {
  return <nav className="breadcrumb" aria-label="Ubicación en Coordinación">
    <ol>
      <li>Coordinación</li>
      {(parents ?? (parent ? [parent] : [])).map(item => <li key={item.href}><span aria-hidden="true">›</span> <Link href={item.href}>{item.label}</Link></li>)}
      <li><span aria-hidden="true">›</span> <span aria-current="page">{current}</span></li>
    </ol>
  </nav>;
}
