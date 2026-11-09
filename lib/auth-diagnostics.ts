/** Allowlist diagnostics: never log OAuth responses, request bodies or credentials. */
export function authDiagnostics(error: Error) {
  const auth = error as Error & { type?: string; cause?: Record<string, unknown> };
  const cause = auth.cause ?? {};
  const description = typeof cause.error_description === 'string' ? cause.error_description : '';
  const codes = [
    ...(Array.isArray(cause.error_codes) ? cause.error_codes.filter((code): code is number => typeof code === 'number' && Number.isSafeInteger(code) && code >= 0).map(code => `AADSTS${code}`) : []),
    ...description.matchAll(/\bAADSTS\d+\b/g),
  ].map(value => typeof value === 'string' ? value : value[0]);
  return {
    type: typeof auth.type === 'string' && /^[A-Za-z]+$/.test(auth.type) ? auth.type : 'AuthError',
    provider: cause.providerId === 'microsoft-entra-id' ? cause.providerId : undefined,
    providerError: typeof cause.error === 'string' && /^[a-z_]{1,60}$/.test(cause.error) ? cause.error : undefined,
    codes: [...new Set(codes)],
    correlationId: typeof cause.correlation_id === 'string' && /^[0-9a-f-]{36}$/i.test(cause.correlation_id) ? cause.correlation_id : undefined,
  };
}
