import { requireLocalDemo, requireTestRecipients } from '../lib/local-demo.mjs';
import postgres from 'postgres';
import { parse } from 'csv-parse/sync';
import { readFile } from 'node:fs/promises';

const url = requireLocalDemo();

const rows = parse(await readFile(new URL('./registro-ficticio.csv', import.meta.url), 'utf8'),
  { columns: true, bom: true, skip_empty_lines: true, trim: true });
requireTestRecipients(rows.map(row => row.correo));
const sql = postgres(url.href);
try {
  await sql.begin(async tx => {
    await tx`insert into grants(subject,role) values ('local-admin','admin'),('local-coordination','general')
      on conflict do nothing`;
    for (const row of rows) {
      const [person] = await tx`insert into volunteers(identification,name,surname,email)
        values (${row.identificacion},${row.nombre},${row.primer_apellido},${row.correo})
        on conflict (identification) do update set identification=excluded.identification,email=excluded.email returning id`;
      const number = `DEMO-REGISTRO-${row.identificacion}`;
      await tx`insert into policies(volunteer_id,kind,number,starts,ends,source,verified_by,verified_at)
        select ${person.id},'Prueba',${number},'2026-11-01'::date,'2026-12-31'::date,
          'Póliza ficticia para pruebas locales','local-admin',now()
        where not exists (select 1 from policies where volunteer_id=${person.id} and number=${number})`;
    }
  });
  console.log(`Registro de prueba preparado: ${rows.length} personas con pólizas ficticias.`);
} finally {
  await sql.end();
}
