/** Check a fresh source tree without Next-generated files or any dotenv credentials. */
import { mkdtemp, cp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { cleanTestEnvironment } from '../../tests/test-process.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'asvo-ci-types-'));
try {
  for (const name of ['app', 'lib', 'public', 'tsconfig.json', 'next.config.ts', 'package.json'])
    await cp(join(root, name), join(directory, name), { recursive: true });
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  const env = {
    ...cleanTestEnvironment(),
    NEXT_TELEMETRY_DISABLED: '1',
    ASVO_DEMO: '0',
    APP_URL: 'https://example.test',
  };
  for (const args of [
    ['node_modules/next/dist/bin/next', 'typegen'],
    ['node_modules/typescript/bin/tsc', '--noEmit'],
  ]) {
    const result = spawnSync(process.execPath, args, {
      cwd: directory,
      env,
      stdio: 'inherit',
      timeout: 90_000,
    });
    if (result.error || result.status !== 0) throw Error('Typecheck de copia limpia falló.');
  }
  console.log('OK: Next typegen y TypeScript en copia limpia, sin .env ni .next preexistente.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
