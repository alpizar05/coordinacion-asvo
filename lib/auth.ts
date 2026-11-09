import NextAuth, { customFetch } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { cookies } from 'next/headers';
import { demo, demoAdmin, demoCoordinator, sql } from './db';
import { authDiagnostics, withEntraDiagnostics } from './auth-diagnostics';

const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
const tenant = issuer?.match(/^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/i)?.[1];
const entra = tenant ? MicrosoftEntraID({ issuer }) : null;
if (entra) entra[customFetch] = withEntraDiagnostics(entra[customFetch] ?? fetch);

export const { auth, handlers, signIn, signOut } = NextAuth({
  logger: {
    error(error) {
      console.error('[auth][diagnostic]', JSON.stringify(authDiagnostics(error)));
    },
  },
  providers: entra ? [entra] : [],
  callbacks: {
    jwt({ token, profile }) {
      if (profile) token.staffSubject = profile.tid === tenant ? profile.oid : null;
      return token;
    },
    session({ session, token }) {
      return { ...session, staffSubject: token.staffSubject };
    },
  },
});

export async function staff() {
  let subject: unknown;
  if (demo) {
    const role = (await cookies()).get('asvo-demo')?.value;
    subject = role === 'admin' ? demoAdmin : role === 'general' ? demoCoordinator : null;
  } else {
    const session = await auth();
    subject = session && 'staffSubject' in session ? session.staffSubject : null;
  }
  if (typeof subject !== 'string') return null;
  const grants = await sql<{ role: string; unit: string }[]>`select role,unit from grants where subject=${subject}`;
  return { subject, grants };
}

export function canOperate(user: Awaited<ReturnType<typeof staff>>, unit?: string) {
  return !!user?.grants.some(grant => grant.role === 'general' || (unit && grant.role === 'unidad' && grant.unit === unit));
}

export function canAdminister(user: Awaited<ReturnType<typeof staff>>) {
  return !!user?.grants.some(grant => grant.role === 'admin');
}

export function requireStaff(user: Awaited<ReturnType<typeof staff>>, allowed: boolean): asserts user {
  if (!user || !allowed) throw new Error('Acceso denegado.');
}
