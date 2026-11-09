import assert from 'node:assert/strict';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import parseProviders from '../node_modules/@auth/core/lib/utils/providers.js';
import { inspectEntraTokenResponse, withEntraDiagnostics } from '../lib/auth-diagnostics.ts';

const logs = [];
const original = console.error;
console.error = (...args) => logs.push(args.join(' '));
try {
  const body = { error: 'invalid_client', error_codes: [7000215], error_description: 'AADSTS7000215: secret-not-for-logs', access_token: 'token-not-for-logs' };
  const response = new Response(JSON.stringify(body), { status: 400 });
  const wrapped = withEntraDiagnostics(async () => response);
  const result = await wrapped('https://login.microsoftonline.com/tenant/oauth2/v2.0/token');
  assert.equal(result,response);
  assert.deepEqual(await result.json(),body,'La respuesta queda disponible para Auth.js');
  assert.equal(logs.length,1);
  assert.ok(logs[0].includes('AADSTS7000215'));
  assert.ok(logs[0].includes('invalid_client'));
  assert.ok(!logs[0].includes('not-for-logs'));
  const ok = withEntraDiagnostics(async () => new Response(JSON.stringify({ access_token: 'private-token' })));
  await ok('https://login.microsoftonline.com/tenant/oauth2/v2.0/token');
  const unrelated = withEntraDiagnostics(async () => new Response(JSON.stringify(body), { status: 400 }));
  await unrelated('https://graph.microsoft.com/v1.0/me');
  assert.equal(logs.length,1,'No registra respuestas exitosas ni de otros servicios');
  const provider = MicrosoftEntraID({ issuer: 'https://login.microsoftonline.com/tenant/v2.0', token: { conform: inspectEntraTokenResponse } });
  const parsed = parseProviders({ providerId: 'microsoft-entra-id', config: { providers: [provider] }, url: new URL('https://example.test/api/auth/callback/microsoft-entra-id') });
  assert.equal(typeof parsed.provider.token.conform,'function','El hook sobrevive a la normalización de Auth.js');
  const tokenResponse = new Response(JSON.stringify(body), { status: 400 });
  assert.equal(await parsed.provider.token.conform(tokenResponse),tokenResponse);
  assert.equal(logs.length,2);
  assert.ok(logs[1].includes('AADSTS7000215'));
  assert.ok(!logs[1].includes('not-for-logs'));
  const discovery = new Response(JSON.stringify({ issuer: 'https://login.microsoftonline.com/tenant/v2.0' }));
  const providerFetch = withEntraDiagnostics(async () => discovery);
  assert.equal(await providerFetch('https://login.microsoftonline.com/tenant/v2.0/.well-known/openid-configuration'),discovery);
} finally { console.error = original; }
console.log('OK: error de Entra capturado, respuesta preservada, secretos y tokens omitidos.');
