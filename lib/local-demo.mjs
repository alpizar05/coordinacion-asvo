/** Validate before opening a connection. Query parameters must not override the URL host. */
export function requireLocalDemo(env = process.env) {
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error('Configurá DATABASE_URL para una base demo local.'); }
  const safeOptions = new Set(['sslmode', 'application_name', 'connect_timeout']);
  if (env.ASVO_DEMO !== '1' || !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      [...url.searchParams.keys()].some(key => !safeOptions.has(key))) {
    throw new Error('Este comando exige ASVO_DEMO=1 y PostgreSQL local, sin opciones que redirijan la conexión.');
  }
  return url;
}

export function requireTestRecipients(recipients) {
  if (recipients.some(email => !String(email ?? '').trim().toLowerCase().endsWith('.test'))) {
    throw new Error('Los datos demo deben usar exclusivamente destinatarios .test.');
  }
}
