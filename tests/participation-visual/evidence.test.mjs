// Offline assertions over observations; not a browser runner or a substitute for CUA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const read = async name => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const { cases } = await read('./results.json');
const stages = await read('./persistence.json');
const final = stages.at(-1);
test('393 distinct CUA observations cover both requested dimensions without horizontal overflow', async () => {
  assert.equal(cases.length, 393);
  assert.equal(new Set(cases.map(x => x.name)).size, cases.length);
  const sizes = new Set();
  for (const item of cases) {
    const data = await read('./' + item.file);
    sizes.add(data.dom.viewport.join('x'));
    assert.equal(data.dom.overflow, false, item.name);
    assert.doesNotMatch(JSON.stringify(data), /(?:\/resumen-salida\/|invitacion=)[\w-]{43}/);
  }
  assert.deepEqual([...sizes].sort(), ['1440x900', '390x844']);
  assert.equal((await readdir(new URL('./evidence/', import.meta.url))).filter(x => x.endsWith('.png')).length, 323);
});
test('local snapshots show incomplete draft without attendance, then two finalized reports', () => {
  for (const name of ['desktop-draft', 'mobile-draft']) {
    const draft = stages.find(x => x.stage === name).reports.find(x => x.status === 'borrador');
    assert.ok(draft, name);
    assert.equal(draft.submitted_at, null);
    assert.equal(draft.participants.some(x => x.attended), false);
    assert.equal(draft.actions, '');
    assert.equal(draft.host, '');
  }
  assert.equal(final.reports.length, 2);
  for (const report of final.reports) {
    assert.equal(report.status, 'finalizado');
    assert.ok(report.submitted_at);
    assert.equal(report.participants.filter(x => x.attended).length, 1);
    assert.ok(report.actions); assert.ok(report.host);
  }
});
test('split membership, invitations, reminders and local outbox are consistent', () => {
  const splits = final.outings.filter(x => x.title.startsWith('Grupo Ficticio'));
  assert.equal(splits.length, 2);
  for (const outing of splits) {
    assert.equal(outing.capacity, 2); assert.equal(outing.listed, false); assert.equal(outing.flexible, true);
    assert.equal(final.registrations.filter(x => x.outing_id === outing.id).length, 2);
  }
  assert.equal(new Set(final.registrations.map(x => `${x.outing_id}:${x.volunteer_id}`)).size, final.registrations.length);
  assert.equal(final.invitations.n, 2);
  assert.equal(final.reminders.length, 2);
  assert.ok(final.reminders.every(x => x.demo && !x.queued && x.recipient.endsWith('.test')));
  assert.deepEqual(final.mail, { n: 0, accepted: 0 });
  for (const action of ['Asignó como 70', 'Retiró asignación de 70', 'Recuperó inscripción anterior', 'Reactivó y confirmó inscripción cancelada', 'Creó salida desde agrupación', 'Guardó borrador de informe', 'Finalizó informe de salida']) {
    assert.ok(final.audit.some(x => x.action === action), action);
  }
});
