import assert from 'node:assert/strict';
import { registrationMailTemplate, registrationStatusLabels } from '../lib/registration-mail-template.mjs';
const options = {
  origin: 'https://example.test', url: 'https://example.test/privado/test-token',
  message: 'Recibimos tu solicitud.\nMotivo: <script>alert("x")</script>',
  entry: { name: 'Ana <img>', surname: 'Prueba', title: 'Salida & conservación', location: 'Parque',
    unit: 'Voluntariado General', starts: '2026-11-14', ends: '2026-11-15' },
};
for (const status of Object.keys(registrationStatusLabels)) {
  const result = registrationMailTemplate({ ...options, entry: { ...options.entry, status } });
  assert.ok(result.html.includes(registrationStatusLabels[status]));
  assert.ok(result.html.includes('14/11/2026'));
  assert.ok(result.html.includes('https://example.test/logo-asvo.png'));
  if (status.startsWith('cancelada')) {
    assert.doesNotMatch(result.html + result.body, /\/privado\/|Ver mi inscripción|Este enlace es personal|desde el enlace privado/);
    assert.match(result.body, /La cancelación quedó registrada/);
    assert.match(result.html, /Motivo:/);
    const noLink = registrationMailTemplate({ ...options, url: '', entry: { ...options.entry, status } });
    assert.doesNotMatch(noLink.html, /Ver mi inscripción/);
  } else {
    assert.ok(result.html.includes('https://example.test/privado/test-token'));
    assert.ok(result.body.includes('Ver mi inscripción:'));
  }
  assert.doesNotMatch(result.html, /<script>|Ana <img>/);
  assert.match(result.html, /&lt;script&gt;/);
  if (status === 'espera') assert.match(result.body, /no tenés un cupo reservado/);
  if (status === 'confirmada') assert.match(result.body, /Tu participación está confirmada/);
}
assert.throws(() => registrationMailTemplate({ ...options, entry: { ...options.entry, status: 'revisión' },
  url: 'javascript:alert(1)' }));
console.log('OK: estados, personalización, fechas, logo, enlace y escape HTML.');
