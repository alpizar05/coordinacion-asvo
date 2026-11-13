import {databaseConfiguration} from '../lib/runtime-config.mjs';
import postgres from 'postgres';
import { schemaMigrationOperation } from '../lib/schema-migrations.mjs';

const args = process.argv.slice(2);
let action = 'apply';
if (args.length) {
  if (args.length===1&&['--status','--plan'].includes(args[0])) action=args[0].slice(2);
  else if (args.length===2&&args[0]==='--adopt'&&args[1]==='--apply') action='adopt';
  else throw new Error('Usá db:setup/db:migrate, db:status, db:plan o db:adopt -- --apply. Para ejemplos: db:seed:demo; para datos históricos: db:migrate:history -- --apply.');
}
const sql = postgres(databaseConfiguration(process.env).url,{max:1});
try { console.log(JSON.stringify(await schemaMigrationOperation(sql,{action}),null,2)); }
finally { await sql.end(); }
