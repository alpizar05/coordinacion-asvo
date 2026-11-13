import { schemaMigrationOperation } from './schema-migrations.mjs';
/** Explicit schema migrations only. Never demo, historical transformations or mail. */
export async function prepareDatabase(sql) {
  return schemaMigrationOperation(sql);
}
