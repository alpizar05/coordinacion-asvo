import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SplitGroupForm } from '../../app/coordinacion/split-group-form.tsx';
import { ListPositionRestorer } from '../../app/coordinacion/navigation-context.tsx';
import { state } from './stubs.mjs';

test('split consumer requires destination without interpreting missing payload as success', async () => {
  const action = SplitGroupForm({ outingId: 'fictitious', starts: '2026-11-20', ends: '2026-11-20', members: [], occupied: 0, title: 'Fictitious' }).props.action;
  globalThis.window = { location: { origin: 'http://localhost:3046', href: 'http://localhost:3046/coordinacion?pestana=informes&dias=14' } };
  for (const response of [undefined, '', { saved: true }, { saved: true, destination: '' }, { saved: true, destination: '  ' }, { saved: 'yes' }, { saved: true, error: 'contradiction' }]) {
    state.response = response;
    const result = await action(new FormData());
    assert.notEqual(result.saved, true);
    assert.ok(result.error);
  }
  state.response = { error: 'General', fieldErrors: { title: ['Título'], capacity: ['Cupo'] } };
  assert.deepEqual(await action(new FormData()), state.response);
  state.response = { saved: true, destination: '/coordinacion?grupoCreado=local' };
  const result = await action(new FormData());
  assert.equal(result.saved, true);
  assert.equal(result.destination, '/coordinacion?grupoCreado=local&pestana=informes&dias=14');
  delete globalThis.window;
});

class ElementDouble {
  closest(selector) { return selector === '.coordination-content' ? this : null; }
}
class FormDouble extends ElementDouble {
  hasAttribute() { return false; }
  contains(target) { return target === this || target.owner === this; }
  querySelector(selector) { return selector === 'fieldset:disabled' && this.pending ? {} : null; }
  closest(selector) { return selector === 'dialog' ? this.dialog : super.closest(selector); }
}
function environment() {
  const listeners = new Map(), frames = [];
  const surface = prefix => ({
    addEventListener(name, callback) { listeners.set(prefix + name, callback); },
    removeEventListener(name) { listeners.delete(prefix + name); },
  });
  globalThis.Element = ElementDouble;
  globalThis.HTMLFormElement = FormDouble;
  globalThis.location = { pathname: '/coordinacion', search: '' };
  globalThis.document = { ...surface('document:'), querySelector: () => null };
  globalThis.window = surface('window:');
  globalThis.requestAnimationFrame = callback => { frames.push(callback); };
  state.context = { pending: { current: null } };
  state.effects = []; state.restores = [];
  state.frame = { destination: '/coordinacion', anchor: 'summary-review-22222222-2222-4222-8222-000000001001', y: 400, offset: 5, list: 'summary-attention' };
  ListPositionRestorer();
  const dispose = state.effects[0]();
  return {
    emit(key, event = {}) { listeners.get(key)?.(event); },
    flush() { while (frames.length) frames.shift()(); },
    close() { dispose(); for (const name of ['Element', 'HTMLFormElement', 'location', 'document', 'window', 'requestAnimationFrame']) delete globalThis[name]; },
  };
}
test('second pointerdown inside submitted form preserves restoration after confirmed save', () => {
  const env = environment();
  try {
    const form = new FormDouble(), button = new ElementDouble(); button.owner = form;
    env.emit('document:submit', { target: form });
    env.emit('window:pointerdown', { type: 'pointerdown', target: button });
    env.emit('window:asvo:navigation-saved'); env.flush();
    assert.deepEqual(state.restores, [state.frame]);
  } finally { env.close(); }
});
for (const cause of ['outside pointer', 'errors', 'history', 'keyboard', 'wheel']) test(`restoration still yields to ${cause}`, () => {
  const env = environment();
  try {
    env.emit('document:submit', { target: new FormDouble() });
    if (cause === 'outside pointer') env.emit('window:pointerdown', { type: 'pointerdown', target: new ElementDouble() });
    if (cause === 'errors') env.emit('window:asvo:form-errors');
    if (cause === 'history') env.emit('window:popstate');
    if (cause === 'keyboard') env.emit('window:keydown', { key: 'Tab', target: new ElementDouble() });
    if (cause === 'wheel') env.emit('window:wheel', { type: 'wheel', target: new ElementDouble() });
    env.emit('window:asvo:navigation-saved'); env.flush();
    assert.deepEqual(state.restores, []);
  } finally { env.close(); }
});
for (const from of ['form', 'dialog heading']) test(`blocked Escape preserves pending submission from its ${from}`, () => {
  const env = environment();
  try {
    const form = new FormDouble(), target = new ElementDouble(); form.pending = true;
    if (from === 'form') target.owner = form;
    else form.dialog = { contains: candidate => candidate === target };
    env.emit('document:submit', { target: form });
    env.emit('window:keydown', { key: 'Escape', target });
    env.emit('window:asvo:navigation-saved'); env.flush();
    assert.deepEqual(state.restores, [state.frame]);
  } finally { env.close(); }
});
for (const cause of ['nonpending Escape', 'unrelated dialog', 'error then Escape']) test(`Escape still yields to ${cause}`, () => {
  const env = environment();
  try {
    const form = new FormDouble(), target = new ElementDouble(); form.pending = cause !== 'nonpending Escape';
    if (cause !== 'unrelated dialog') target.owner = form;
    env.emit('document:submit', { target: form });
    if (cause === 'error then Escape') env.emit('window:asvo:form-errors');
    env.emit('window:keydown', { key: 'Escape', target });
    env.emit('window:asvo:navigation-saved'); env.flush();
    assert.deepEqual(state.restores, []);
  } finally { env.close(); }
});
