import Link from 'next/link';

export default function CoordinationBreadcrumb({ current, parent }: {
  current: string;
  parent?: { href: string; label: string };
}) {
  return <nav className="breadcrumb" aria-label="Ubicación en Coordinación">
    <ol>
      <li>Coordinación</li>
      {parent && <li><span aria-hidden="true">›</span> <Link href={parent.href}>{parent.label}</Link></li>}
      <li><span aria-hidden="true">›</span> <span aria-current="page">{current}</span></li>
    </ol>
  </nav>;
}
