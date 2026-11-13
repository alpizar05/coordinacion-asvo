import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMailCron } from '../../lib/mail-cron.ts';
test('cron authorization and dispatch outcomes with injected service',async()=>{

let calls = 0;
const options = { secret: 'test-only-secret', enabled: true, flush: async () => {
  calls++; return { sent: 2, failed: 0 };
} };
const request = authorization => new Request('http://localhost/api/cron/correos', {
  headers: authorization ? { authorization } : {},
});
assert.equal((await handleMailCron(request(), options)).status, 401);
assert.equal((await handleMailCron(request('Bearer incorrecto'), options)).status, 401);
assert.equal((await handleMailCron(request(), { ...options, secret: undefined })).status, 503);
assert.equal((await handleMailCron(request('Bearer test-only-secret'), { ...options, enabled: false })).status, 503);
assert.equal(calls, 0, 'Ninguna solicitud rechazada debe procesar correo');
const response = await handleMailCron(request('Bearer test-only-secret'), options);
assert.equal(response.status, 200);
assert.match(response.headers.get('cache-control'), /no-store/);
assert.deepEqual(await response.json(), { sent: 2, failed: 0 });
assert.equal(calls, 1);
assert.equal((await handleMailCron(request('Bearer test-only-secret'), {
  ...options, flush: async () => ({ sent: 0, failed: 1 }),
})).status, 503);
const failed = await handleMailCron(request('Bearer test-only-secret'), {
  ...options, flush: async () => { throw new Error('private database credentials'); },
});
assert.equal(failed.status, 503);
assert.doesNotMatch(await failed.text(), /credentials/);
});
