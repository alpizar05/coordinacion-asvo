'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { logout } from '../staff-actions';
import { Drawer } from '../drawer';
import { siteNavigationLinks } from '../navigation';
import { usePathname } from 'next/navigation';

const operations = [
  { path: '/coordinacion', title: 'Convocatorias de salida', detail: 'Creá y gestioná las salidas.' },
  { path: '/coordinacion/inscripciones', title: 'Solicitudes de inscripción', detail: 'Revisá y resolvé las solicitudes.' },
];

export default function CoordinationNav({ showOperations, showVolunteers, showDemoInbox }: {
  showOperations: boolean; showVolunteers: boolean; showDemoInbox: boolean;
}) {
  const pathname = usePathname();
  const [menuSlot, setMenuSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setMenuSlot(document.getElementById('coordination-mobile-menu-slot'));
  }, []);
  const sections = showOperations ? [...operations] : [
    { path: '/coordinacion', title: 'Administración', detail: 'Gestioná los accesos del personal.' },
  ];
  if (showVolunteers) sections.push({
    path: '/coordinacion/registro', title: 'Voluntariado', detail: 'Consultá el registro de personas voluntarias.',
  });
  const items = <ul>
      {sections.map(({ path, title, detail }) => {
        const active = pathname === path || pathname.startsWith(path === '/coordinacion' ? '/coordinacion/salidas/' : path + '/') ||
          (path === '/coordinacion' && pathname.startsWith('/coordinacion/colecciones/'));
        return <li key={path}>
          <Link href={path} aria-current={active ? (pathname === path ? 'page' : 'true') : undefined}>
            <strong>{title}</strong>
            <span>{detail}</span>
          </Link>
        </li>;
      })}
      {showDemoInbox && <li>
        <Link href="/pruebas/correo">
          <strong>Bandeja de prueba · Demo</strong>
          <span>Consultá los correos de prueba.</span>
        </Link>
      </li>}
    </ul>;

  return <>
    <nav className="coordination-nav coordination-nav-desktop" aria-label="Menú de Coordinación">{items}</nav>
    {menuSlot && createPortal(<Drawer className="mobile-nav coordination-nav-mobile" label="Menú" title="Menú" closeOnLink>
      <nav className="coordination-site-links" aria-label="Navegación del portal">
        <p className="coordination-nav-label">Portal de voluntariado</p>
        <ul>{siteNavigationLinks.map(({ href, label }) => <li key={href}>
          <Link className="nav-link" href={href}>{href === "/" ? "Convocatorias públicas" : `Inicio de ${label}`}</Link>
        </li>)}</ul>
      </nav>
      <nav className="coordination-nav" aria-label="Menú de Coordinación">
        <p className="coordination-nav-label">Coordinación</p>
        {items}
      </nav>
      <form className="coordination-menu-logout" action={logout}>
        <button type="submit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 5H5v14h5m4-11 4 4-4 4m-5-4h9" />
          </svg>
          Cerrar sesión
        </button>
      </form>
    </Drawer>, menuSlot)}
  </>;
}
