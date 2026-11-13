import 'server-only';
import {readAuthConfiguration,assertDemoHost} from './server-config.mjs';
import {validTenantSubject} from './runtime-config.mjs';
import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { cookies,headers } from 'next/headers';
import { demo, demoAdmin, demoCoordinator, sql } from './db';
import { authDiagnostics, inspectEntraTokenResponse } from './auth-diagnostics';

const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
const tenant = issuer?.match(/^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/i)?.[1];
const entra = tenant ? MicrosoftEntraID({
  issuer,
  client: { token_endpoint_auth_method: 'client_secret_post' },
  token: { conform: inspectEntraTokenResponse },
}) : null;

export const { auth, handlers, signIn, signOut } = NextAuth({
  logger: {
    error(error) {
      console.error('[auth][diagnostic]', JSON.stringify({ version: 'entra-post-v4', ...authDiagnostics(error) }));
    },
  },
  providers: entra ? [entra] : [],
  callbacks: {
    jwt({ token, profile }) {
      if (profile) token.staffSubject = validTenantSubject(profile,tenant);
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
    assertDemoHost((await headers()).get('host')||'');
    const role = (await cookies()).get('asvo-demo')?.value;
    subject = role === 'admin' ? demoAdmin : role === 'general' ? demoCoordinator : null;
  } else {
    readAuthConfiguration();
    const session = await auth();
    subject = session && 'staffSubject' in session ? session.staffSubject : null;
  }
  if (typeof subject !== 'string') return null;
  const grants = await sql<{ role: string; unit: string }[]>`select role,unit from grants where subject=${subject}`;
  return { subject, grants };
}

// Existing imports remain compatible; the executable matrix is the single policy source.
export {canOperate,canAdminister,allows,staffScope} from './authorization';

export function requireStaff(user: import('./authorization').StaffPrincipal, allowed: boolean): asserts user {
  if (!user || !allowed) throw new Error('Acceso denegado.');
}
