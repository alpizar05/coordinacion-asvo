import { requireLocalDemo } from '../lib/local-demo.mjs';
import postgres from 'postgres';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const url = requireLocalDemo();

const weekend = [[7, 8], [14, 15], [21, 22], [28, 29]];
const calendar = [
  { key: 1, place: 'Parque Nacional La Cangreja', task: 'Mantenimiento de senderos',
    logistics: 'Participación de un día. Sin hospedaje.', capacity: 4, blocks: [[7, 7], [8, 8]] },
  { key: 2, place: 'RNVSM Maquenque', task: 'Senderos, pintura y apoyo en bodega',
    capacity: 4, blocks: [[7, 8], [14, 15]] },
  { key: 3, place: 'Parque Nacional Cahuita (Puerto Vargas)', task: 'Mantenimiento de senderos',
    capacity: 5, blocks: [[7, 8], [13, 15, 'Construcción de habitación para funcionaria', 6], [21, 22], [28, 29]] },
  { key: 4, place: 'Monumento Nacional Guayabo', task: 'Mantenimiento de senderos', capacity: 4, blocks: weekend },
  { key: 5, place: 'Parque Nacional Volcán Poás', task: 'Atención de turismo y mantenimiento de senderos',
    capacity: 4, flexible: true, blocks: weekend },
  { key: 6, place: 'Parque Nacional del Agua', task: 'Mantenimiento de senderos y apoyo en vivero',
    capacity: 8, flexible: true, blocks: [[14, 15], [28, 29]] },
  { key: 7, place: 'Parque Nacional Corcovado (San Pedrillo)', task: 'Senderos, atención de turismo y gestión de residuos',
    capacity: 1, blocks: [[3, 10], [10, 17], [17, 24]] },
  { key: 8, place: 'Parque Nacional Tapantí', task: 'Limpieza de senderos y pintura de techo',
    capacity: 3, flexible: true, blocks: [[7, 8], [21, 22]] },
  { key: 9, place: 'Estación Robles-Kaufman (Tortuguero)', task: 'Mantenimiento de estación y apoyo en JaguarFest',
    capacity: 6, blocks: [[13, 15, 'Mantenimiento de estación'],
      [20, 22, 'Mantenimiento de estación y preparación del JaguarFest'],
      [27, 29, 'Apoyo y participación en JaguarFest']] },
];

const id = (key, block = 0) => `b41c72d2-07a7-45f7-a226-${String(key * 100 + block).padStart(12, '0')}`;
const date = day => `2026-11-${String(day).padStart(2, '0')}`;
const unit = 'Voluntariado General';
const picture = sharp(fileURLToPath(new URL('../public/voluntariado-asvo.jpeg', import.meta.url))).autoOrient();
const [thumbnail, display] = await Promise.all([
  picture.clone().resize(560, 350, { fit: 'cover' }).webp().toBuffer(),
  picture.clone().resize(1440, 1100, { fit: 'inside', withoutEnlargement: true }).webp().toBuffer(),
]);
const alt = 'Foto ilustrativa de personas voluntarias de ASVO';
const sql = postgres(url.href);

try {
  const result = await sql.begin(async tx => {
    let added = 0;
    let updated = 0;
    const robles = await tx`select id,request_id,starts::text,ends::text
      from outings where location ilike '%Robles%' and starts in ('2026-11-13','2026-11-20','2026-11-27')
      and unit=${unit} order by starts,id for update`;
    const roblesRequests = new Set(robles.map(row => row.request_id));
    if (roblesRequests.size > 1 || new Set(robles.map(row => row.starts)).size !== robles.length) {
      throw new Error('Hay varios bloques de Tortuguero que coinciden. Revisalos antes de cargar el calendario.');
    }

    for (const group of calendar) {
      const existing = group.key === 9 ? robles : [];
      const requestId = existing[0]?.request_id ?? id(group.key);
      const logistics = group.logistics ?? (group.flexible ? 'Podés participar uno o ambos días del bloque.' : '');
      const defaults = { title: group.place, location: group.place, unit, requirements: group.task, logistics };
      await tx`insert into requests(id,organization,area,activity,plan,logistics,outing_defaults,outing_photos_initialized)
        values (${requestId},'ASVO · Calendario de prueba',${group.place},'Voluntariado ambiental',
          ${group.task},${logistics},${tx.json(defaults)},true)
        on conflict (id) do nothing`;

      if (existing.length) {
        await tx`update requests set area=${group.place},plan=${group.task},
          outing_defaults=coalesce(outing_defaults,'{}'::jsonb) || ${tx.json(defaults)} where id=${requestId}`;
      }
      await tx`insert into request_outing_photos
        (request_id,position,alt,credit,thumbnail,display_image)
        values (${requestId},1,${alt},'ASVO',${thumbnail},${display})
        on conflict (request_id,position) do nothing`;
      await tx`update requests set outing_photos_initialized=true where id=${requestId}`;

      for (const [index, [first, last, task = group.task, capacity = group.capacity]] of group.blocks.entries()) {
        const starts = date(first);
        const ends = date(last);
        const previous = existing.find(row => row.starts === starts && row.ends === ends);
        const outingId = previous?.id ?? id(group.key, index + 1);
        const overrides = task === group.task ? [] : ['requirements'];

        if (previous) {
          await tx`update outings set title=${group.place},location=${group.place},requirements=${task},
            outing_overrides=array(
              select distinct value from unnest(outing_overrides || ${overrides}::text[]) as items(value)
              where value not in ('title','location') and (value <> 'requirements' or ${overrides.length > 0})
            ) where id=${outingId}`;
          updated++;
        } else {
          const rows = await tx`insert into outings
            (id,request_id,title,location,unit,starts,ends,flexible,capacity,requirements,logistics,status,listed,registration_deadline,outing_overrides)
            values (${outingId},${requestId},${group.place},${group.place},${unit},${starts},${ends},
              ${!!group.flexible},${capacity},${task},${logistics},'abierta',true,${starts},${overrides})
            on conflict (id) do nothing returning id`;
          added += rows.length;
          if (!rows.length) continue;
        }

        if (!(await tx`select id from outing_photos where outing_id=${outingId} and position=1`).length) {
          await tx`insert into outing_photos
            (outing_id,position,alt,credit,original_item,original_drive,thumbnail,display_image)
            select ${outingId},position,alt,credit,original_item,original_drive,thumbnail,display_image
            from request_outing_photos where request_id=${requestId}`;
          await tx`update outings set outing_overrides=array_remove(outing_overrides,'photos') where id=${outingId}`;
        }
        await tx`insert into audit(actor,action,target,reason)
          values ('local-coordination','Cargó calendario de prueba',${outingId},'Noviembre 2026')`;
      }
    }
    return { added, updated };
  });
  console.log(`Calendario de noviembre: ${result.added} bloques nuevos y ${result.updated} actualizados.`);
} finally {
  await sql.end();
}
