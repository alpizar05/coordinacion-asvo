import Link from 'next/link';
import { Drawer } from './drawer';

export const siteNavigationLinks = [
  { href: '/', label: 'Convocatorias' },
  { href: '/coordinacion', label: 'Coordinación' },
];

export function Navigation() {
  const items = siteNavigationLinks.map(({ href, label }) => <li key={href}><Link className="nav-link" href={href}>{label}</Link></li>);

  return <>
    <nav className="desktop-nav" aria-label="Navegación principal"><ul>{items}</ul></nav>
    <div id="coordination-mobile-menu-slot" className="mobile-menu-slot" />
    <Drawer label="Menú" title="Menú" className="mobile-nav site-mobile-nav" closeOnLink>
      <nav aria-label="Navegación principal"><ul>{items}</ul></nav>
    </Drawer>
  </>;
}
