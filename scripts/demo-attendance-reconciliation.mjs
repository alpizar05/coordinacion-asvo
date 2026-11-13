import { requireLocalDemo } from '../lib/local-demo.mjs';
import postgres from 'postgres';
const url = requireLocalDemo();

const sql = postgres(url.href);
const id = n => `a7700000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const outing=id(1), request=id(2);
const people=[{id:id(10),registration:id(20),name:'María',surname:'Ejemplo'},
  {id:id(11),registration:id(21),name:'Rayner',surname:'Prueba'},
  {id:id(12),registration:id(22),name:'Marco',surname:'Prueba'}];
try {
  await sql.begin(async tx=>{
    await tx`insert into requests(id,organization,activity) values (${request},'ASVO · Ejemplo ficticio','Demostración de conciliación') on conflict do nothing`;
    await tx`insert into outings(id,request_id,title,location,unit,starts,ends,flexible,capacity,status,listed)
      values (${outing},${request},'DEMO · Tapantí · Conciliación de asistencia','Parque Nacional Tapantí','Voluntariado General',
      (clock_timestamp() at time zone 'America/Costa_Rica')::date-3,
      (clock_timestamp() at time zone 'America/Costa_Rica')::date-2,true,6,'completada',false) on conflict do nothing`;
    for (const [index,person] of people.entries()) {
      await tx`insert into volunteers(id,identification,name,surname,email) values (${person.id},${`DEMOASISTENCIA${index}`},${person.name},${person.surname},${`asistencia${index}@example.test`}) on conflict do nothing`;
      await tx`insert into registrations(id,outing_id,volunteer_id,identification,starts,ends,status,details)
        select ${person.registration},o.id,${person.id},${`DEMOASISTENCIA${index}`},o.starts,o.ends,'confirmada',${tx.json({assigned70:index>0})}
        from outings o where o.id=${outing} on conflict do nothing`;
    }
    for (const index of [1,2]) {
      const participants=people.map((person,i)=>({id:person.registration,name:`${person.name} ${person.surname}`,attended:i===0 ? index===1 : true}));
      const note=index===1 ? 'María apoyó durante el primer día, junto con mi equipo.' : 'Mi equipo trabajó el segundo día. María no estuvo con nuestro grupo.';
      await tx`insert into outing_reports(id,outing_id,lead_registration_id,lead_name,lead_email,labour,location,activity,starts,ends,actions,host,observations,participants,status)
        select ${id(30+index)},o.id,${people[index].registration},${`${people[index].name} ${people[index].surname}`},${`asistencia${index}@example.test`},
          'Mantenimiento y otros',o.location,'Salida general (mantenimiento, colaboración en oficinas, ferias)',o.starts,o.ends,'Limpieza de senderos.','Persona responsable ficticia',${note},${tx.json(participants)},'finalizado'
        from outings o where o.id=${outing} on conflict do nothing`;
    }
  });
  console.log(`/coordinacion/salidas/${outing}?pestana=herramientas#asistencia`);
} finally {await sql.end();}
