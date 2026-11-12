import { NavigationContextProvider } from './navigation-context';
import './coordination.css';
import { ConfirmationProvider } from '../status-ribbon';
import { ConfirmationFromUrl } from './confirmation-from-url';
import { Suspense } from 'react';
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

  return <ConfirmationProvider><Suspense fallback={null}><ConfirmationFromUrl /></Suspense><div className="coordination-content" data-navigation-demo={demo ? 'true' : undefined}>
    {user && <header className="coordination-header">
      <p className="coordination-nav-label">Coordinación</p>
      <form className={operates || admin ? "coordination-logout-desktop" : undefined} data-navigation-session-end action={logout}><button type="submit">Cerrar sesión</button></form>
    </header>}
    {(operates || admin) && <CoordinationNav showAdministration={admin} showOperations={operates} showVolunteers={general || admin} showDemoInbox={demo && general} />}
    <NavigationContextProvider key={user?.subject ?? 'anonymous'} subject={user?.subject ?? 'anonymous'}>{children}</NavigationContextProvider>
  </div></ConfirmationProvider>;
}
