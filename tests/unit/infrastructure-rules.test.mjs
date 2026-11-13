import test from 'node:test';import assert from 'node:assert/strict';
import {migrationCommands,requireTransactionalMigration} from '../../lib/migration-sql.mjs';
import {requireLocalDemo,requireTestRecipients} from '../../lib/local-demo.mjs';
test('demo destination requires explicit demo and a loopback URL without host overrides',()=>{
 for(const hostname of ['localhost','127.0.0.1','[::1]'])assert.equal(requireLocalDemo({ASVO_DEMO:'1',DATABASE_URL:`postgres://user:fake@${hostname}:5432/disposable?sslmode=disable`}).hostname,hostname);
 for(const env of [{},{ASVO_DEMO:'0',DATABASE_URL:'postgres://localhost/x'},{ASVO_DEMO:'1',DATABASE_URL:'https://localhost/x'},{ASVO_DEMO:'1',DATABASE_URL:'postgres://remote.invalid/x'},{ASVO_DEMO:'1',DATABASE_URL:'postgres://localhost/x?host=remote.invalid'},{ASVO_DEMO:'1',DATABASE_URL:'postgres://localhost/x?%68ostaddr=remote.invalid'}])assert.throws(()=>requireLocalDemo(env));
 requireTestRecipients(['person@example.test',' person@EXAMPLE.TEST ']);for(const email of ['person@example.invalid','person.test@example.org',null])assert.throws(()=>requireTestRecipients([email]));
});
test('migration transaction guard ignores quoted/commented bodies but rejects transaction escapes',()=>{
 assert.deepEqual(migrationCommands('/* outer /* nested */ comment */ select 1; -- comment\n select 2'),['SELECT 1','SELECT 2']);
 requireTransactionalMigration("do $tag$ begin perform 1; end $tag$; select 'COMMIT;'; select \"COMMIT\";",'fixture');
 for(const sql of ['COMMIT;','BEGIN;','rollback;','create unique index concurrently x on y(z);','VACUUM;'])assert.throws(()=>requireTransactionalMigration(sql,'fixture'));
 for(const sql of ["select 'unterminated",'/* unclosed','do $$ begin'])assert.throws(()=>migrationCommands(sql));
 assert.equal(migrationCommands("select 'it''s'; select E'back\\\'slash';").length,2);
});
