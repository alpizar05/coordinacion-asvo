import {requireDisposableTestDatabase} from '../tests/integration/target.mjs';
requireDisposableTestDatabase();
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dbUrl = new URL(process.env.DATABASE_URL);
if (process.env.ASVO_DEMO !== '1' || !['localhost','127.0.0.1','[::1]'].includes(dbUrl.hostname)) {
  throw new Error('La prueba requiere una base demo local.');
}
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/.test(specifier)) {
    const candidate = new URL(specifier + '.ts',context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href,context);
  }
  return nextResolve(specifier,context);
} });
const { sql } = await import('../lib/db.ts');
const { searchVolunteers } = await import('../lib/volunteer-search.ts');
const batch = randomUUID().replaceAll('-','');
const ids = Array.from({length:28},()=>randomUUID());
try {
  await sql.begin(async tx => {
    for (let i=0;i<ids.length;i++) await tx`insert into volunteers(id,identification,name,surname,second_surname,email,units)
      values (${ids[i]},${`SEARCH-${batch}-${i}`},'Élena',${`Apellido${i}`},${batch},${`persona${i}-${batch}@example.test`},
        ${i===0 ? ['Voluntariado General','UEA'] : ['Voluntariado General']})`;
  });
  const first = await searchVolunteers(`ELENA ${batch}`,'',1);
  const second = await searchVolunteers(batch,'',2);
  assert.equal(first.total,28); assert.equal(first.people.length,25);
  assert.equal(second.people.length,3);
  assert.equal(new Set([...first.people,...second.people].map(p=>p.id)).size,28);
  assert.equal((await searchVolunteers(batch,'',999)).page,2);
  assert.equal((await searchVolunteers(batch,'',-2)).page,1);
  assert.equal((await searchVolunteers(batch,'UEA',1)).total,1);
  assert.equal((await searchVolunteers(`SEARCH-${batch}-17`,'',1)).people[0].id,ids[17]);
  assert.equal((await searchVolunteers(`persona5-${batch}@example.test`,'',1)).people[0].id,ids[5]);
  assert.equal((await searchVolunteers(`${batch} no-existe`,'',1)).total,0);
  assert.equal((await searchVolunteers(`${batch} %`,'',1)).total,0,'Los comodines deben tratarse como texto literal');
  console.log('OK: búsqueda sin tildes, identificación, correo, unidad y paginación.');
} finally {
  await sql`delete from volunteers where id=any(${ids}::uuid[])`;
  await sql.end();
}
