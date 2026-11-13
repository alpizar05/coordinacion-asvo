import test from 'node:test';import assert from 'node:assert/strict';
test('unit runner does not inherit provider/database credentials or load infrastructure',async()=>{
 assert.deepEqual(Object.keys(process.env).filter(name=>/^(DATABASE|PG|AUTH_|GRAPH_|SHAREPOINT_|CRON_SECRET|BETA_IMPORT|APP_URL)/.test(name)),[]);
 for(const module of ['postgres','next/headers','node:net','node:child_process','../../lib/db.ts'])await assert.rejects(import(module),/prohibida|infraestructura/);
 await assert.rejects(fetch('https://example.test'),/Red prohibida/);
});
