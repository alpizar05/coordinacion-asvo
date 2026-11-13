import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cleanTestEnvironment } from '../../tests/test-process.mjs';
const result = spawnSync(
  'npm',
  [
    'audit',
    '--json',
    '--ignore-scripts',
    '--audit-level=high',
    '--registry=https://registry.npmjs.org',
  ],
  {
    cwd: new URL('../../', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 8_000_000,
    env: {
      ...cleanTestEnvironment(),
      NPM_CONFIG_USERCONFIG: fileURLToPath(new URL('./empty.npmrc', import.meta.url)),
      NPM_CONFIG_GLOBALCONFIG: '/dev/null',
    },
  },
);
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  /* Missing/invalid report must fail closed. */
}
if (
  result.error ||
  !report?.metadata?.vulnerabilities ||
  report.error ||
  ![0, 1].includes(result.status)
) {
  console.error('No se pudo completar npm audit; no se declara revisión satisfactoria.');
  process.exitCode = 1;
} else {
  const findings = Object.values(report.vulnerabilities ?? {}).map((v) => ({
    name: v.name,
    severity: v.severity,
    direct: v.isDirect,
    fixAvailable: !!v.fixAvailable,
    advisories: v.via
      .filter((x) => typeof x === 'object')
      .map((x) => ({ url: x.url, range: x.range })),
  }));
  const output = {
    registry: 'https://registry.npmjs.org',
    vulnerabilities: report.metadata.vulnerabilities,
    findings,
    policy: 'Block high/critical; report lower severities. No automatic fixes.',
  };
  mkdirSync('coverage', { recursive: true });
  writeFileSync('coverage/dependency-audit.json', JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  if (report.metadata.vulnerabilities.high || report.metadata.vulnerabilities.critical)
    process.exitCode = 1;
}
