import postgres from 'postgres';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const url = new URL(process.env.DATABASE_URL);
if (process.env.ASVO_DEMO !== '1' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error('Este ejemplo requiere ASVO_DEMO=1 y una base PostgreSQL local.');
}

const id = number => `e9db65dc-7623-442a-9d31-${String(number).padStart(12, '0')}`;
const outingId = id(2);
const people = [
  ['Ana', 'Prueba', '2026-11-13', '2026-11-14', 'confirmada'],
  ['Luis', 'Prueba', '2026-11-14', '2026-11-15', 'revisión'],
  ['María', 'Prueba', '2026-11-20', '2026-11-22', 'espera'],
  ['Diego', 'Prueba', '2026-11-21', '2026-11-22', 'confirmada'],
];
const image = sharp(fileURLToPath(new URL('../public/voluntariado-asvo.jpeg', import.meta.url)));
const [thumbnail, display] = await Promise.all([
  image.clone().resize(560, 350, { fit: 'cover' }).webp().toBuffer(),
  image.clone().resize(1440, 1100, { fit: 'inside' }).webp().toBuffer(),
]);
const sql = postgres(url.href);
try {
  await sql.begin(async tx => {
    await tx`insert into requests(id,organization,area,activity,plan)
      values (${id(1)},'ASVO · Datos ficticios','Tortuguero','Conservación','Ejemplo de agrupación por fechas flexibles.')
      on conflict (id) do nothing`;
    const [created] = await tx`insert into outings
      (id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed,requirements,logistics)
      values (${outingId},${id(1)},'Demo · Tortuguero: agrupaciones flexibles','Tortuguero','Voluntariado General',
        '2026-11-13','2026-11-22',true,3,'abierta',false,'Ejemplo con personas ficticias.',
        'Dos grupos con inducciones en fechas distintas.')
      on conflict (id) do nothing returning id`;
    if (!created) return;
    await tx`insert into outing_photos(outing_id,position,alt,credit,thumbnail,display_image)
      values (${outingId},1,'Personas voluntarias de ASVO en una actividad de conservación','ASVO',${thumbnail},${display})`;

    await tx`update requests set outing_defaults=jsonb_build_object(
      'title',o.title,'location',o.location,'unit',o.unit,'requirements',o.requirements,'logistics',o.logistics
    ),outing_photos_initialized=true from outings o where o.id=${outingId} and requests.id=o.request_id`;
    await tx`insert into request_outing_photos
      select ${id(1)},position,alt,credit,original_item,original_drive,thumbnail,display_image
      from outing_photos where outing_id=${outingId} and position is not null`;

    for (const [index, [name, surname, starts, ends, status]] of people.entries()) {
      const identification = `DEMOAGRUPACION${index + 1}`;
      const [person] = await tx`insert into volunteers(id,identification,name,surname,email)
        values (${id(10 + index)},${identification},${name},${surname},${`grupo${index + 1}@example.test`})
        on conflict (identification) do update set identification=excluded.identification returning id`;
      const [policy] = await tx`insert into policies(id,volunteer_id,kind,number,starts,ends,source,verified_by,verified_at)
        values (${id(20 + index)},${person.id},'Demo',${identification},'2026-11-01','2026-11-30','Datos ficticios','local-coordination',now())
        returning id`;
      await tx`insert into registrations
        (id,outing_id,volunteer_id,identification,validated_at,validated_by,validation_channel,status,starts,ends,details,policy_id)
        values (${id(30 + index)},${outingId},${person.id},${identification},now(),'local-coordination','demo',
          ${status},${starts},${ends},'{}'::jsonb,${policy.id})`;
    }
    await tx`insert into audit(actor,action,target,reason)
      values ('local-coordination','Decidió agrupación',${outingId},
        'Ejemplo: hacer una inducción conjunta el 14 de noviembre para Ana y Luis. Para María y Diego, coordinar una segunda inducción el 21.')`;
  });
  console.log(`/coordinacion/salidas/${outingId}#agrupaciones`);
} finally {
  await sql.end();
}
