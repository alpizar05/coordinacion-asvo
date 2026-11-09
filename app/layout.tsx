import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import logo from '../public/logo-asvo.png';
import './style.css';
import { Navigation } from './navigation';

export const metadata = {
  title: 'Coordinación de Voluntariado | ASVO',
  description: 'Convocatorias de voluntariado de ASVO',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CR">
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido principal</a>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="brand" aria-label="ASVO, inicio">
              <Image src={logo} alt="ASVO" sizes="(max-width: 580px) 132px, 176px" preload />
            </Link>
            <span className="site-label">Portal de voluntariado</span>
            <Navigation />
          </div>
        </header>
        <main id="contenido" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <Image src={logo} alt="" sizes="112px" />
          <p><strong>Conservación, educación y acción.</strong><br />Asociación de Voluntarios para el Servicio en las Áreas Protegidas</p>
          <span>Costa Rica</span>
        </footer>
      </body>
    </html>
  );
}
