import { isLoopback } from '../../lib/runtime-config.mjs';
import { cleanTestEnvironment } from '../../tests/test-process.mjs';

/** CI has no dotenv loader and never accepts an application/provider credential. */
export function integrationEnvironment(input) {
  if (
    Object.keys(input).some(
      (key) => /^(DATABASE_URL$|GRAPH_|SHAREPOINT_|AUTH_|VERCEL)/.test(key) && input[key],
    )
  ) {
    throw Error(
      'CI rechaza credenciales de aplicación/proveedores; usá solo CI_DATABASE_URL local.',
    );
  }
  let url;
  try {
    url = new URL(input.CI_DATABASE_URL);
  } catch {
    throw Error('CI_DATABASE_URL local requerida.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !isLoopback(url.hostname) ||
    !['/postgres', '/asvo_ci_admin'].includes(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw Error('CI exige PostgreSQL loopback y base administrativa descartable autorizada.');
  }
  return {
    ...cleanTestEnvironment(),
    CI: 'true',
    NODE_ENV: 'development',
    ASVO_DEMO: '1',
    APP_URL: 'http://localhost:3031',
    DATABASE_URL: url.href,
  };
}
