import './coordination.css';
import type { ReactNode } from 'react';
import CoordinationNav from './coordination-nav';
import { canAdminister, staff } from '../../lib/auth';
import { demo } from '../../lib/db';
import { logout } from '../staff-actions';

export default async function CoordinationLayout({ children }: { children: ReactNode }) {
  const user = await staff();
  const general = user?.grants.some(grant => grant.role === 'general') ?? false;
  const admin = canAdminister(user);
  const operates = general || (user?.grants.some(grant => grant.role === 'unidad') ?? false);

  return <div className="coordination-content">
    {user && <header className="coordination-header">
      <p className="coordination-nav-label">Coordinación</p>
      <form className={operates || admin ? "coordination-logout-desktop" : undefined} action={logout}><button type="submit">Cerrar sesión</button></form>
    </header>}
    {(operates || admin) && <CoordinationNav showAdministration={admin} showOperations={operates} showVolunteers={general || admin} showDemoInbox={demo && general} />}
    {children}
  </div>;
}
