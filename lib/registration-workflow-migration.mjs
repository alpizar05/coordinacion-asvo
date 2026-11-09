import { queueRegistrationMail } from './registration-mail.mjs';

/** @param {import('postgres').Sql} sql */
export async function migrateRegistrationWorkflow(sql, options) {
  await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(622617808)`;
    if ((await tx`select 1 from app_migrations where name='received-registration-reservations-v1'`).length) return;
    const outings = await tx`select id,unit,capacity,status from outings order by id for update`;
    for (const outing of outings) {
      if (!['abierta','confirmada'].includes(outing.status)) continue;
      const entries = await tx`select r.id,r.status,r.volunteer_id,r.identification,r.starts::text,r.ends::text,
        v.email,v.units from registrations r left join volunteers v on v.id=r.volunteer_id
        where r.outing_id=${outing.id} and r.status in ('validación','revisión','espera','confirmada')
        order by r.received_at,r.id for update of r`;
      let free = Math.max(0, outing.capacity - entries.filter(entry => entry.status === 'confirmada').length);
      const activePeople = new Set(entries.filter(entry => entry.status !== 'validación').map(entry => entry.volunteer_id));
      for (const entry of entries) {
        let message = 'Actualizamos el flujo de inscripción. Podés gestionar tu solicitud desde este enlace privado.';
        if (entry.status === 'confirmada') {
          await queueRegistrationMail(tx,entry.id,message,options);
          continue;
        }
        let status;
        if (entry.status === 'validación') {
          const [person] = await tx`select id,email,units from volunteers
            where identification=${entry.identification} limit 1`;
          const coverage = person && await tx`select 1 from policies where volunteer_id=${person.id}
            and verified_at is not null and starts<=${entry.starts}::date and ends>=${entry.ends}::date limit 1`;
          if (!person?.email || (outing.unit !== 'Voluntariado General' && !person.units.includes(outing.unit)) ||
              !coverage?.length || activePeople.has(person?.id)) {
            status = 'rechazada';
            message = 'No se pudo incorporar tu solicitud anterior. Revisá con Coordinación tu ficha, tu póliza y si ya tenés una inscripción activa.';
          } else {
            await tx`update registrations set volunteer_id=${person.id} where id=${entry.id}`;
            activePeople.add(person.id);
          }
        }
        if (!status) {
          status = free > 0 ? 'revisión' : 'espera';
          if (free > 0) free--;
          message = status === 'revisión'
            ? 'Recibimos tu inscripción y reservamos un cupo. Coordinación debe confirmar tu participación. Podés gestionar la solicitud desde este enlace.'
            : 'Los cupos están cubiertos y tu inscripción está en lista de espera. Te avisaremos si se libera un cupo.';
        }
        await tx`update registrations set status=${status} where id=${entry.id}`;
        await tx`insert into audit(actor,action,target,reason) values
          ('sistema','Adaptó inscripción al nuevo flujo',${entry.id},${message})`;
        await queueRegistrationMail(tx,entry.id,message,options);
      }
    }
    await tx`insert into app_migrations(name) values ('received-registration-reservations-v1')`;
  });
}
