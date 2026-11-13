import {allowsPhoto,allowsPublicOuting} from '../../../../lib/authorization';
import { readRegistrationReceipt } from '../../../../lib/registration-receipt';
import { staff } from '../../../../lib/auth';
import { activeOutingInvitation, registrationToday } from '../../../../lib/outing-invitations';
import { sql } from '../../../../lib/db';
import { uuid } from '../../../../lib/registration';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid(id)) return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  const preview = query.get('v') === 'tarjeta';
  const [photo] = await sql`select o.id as outing_id,o.status,o.unit,coalesce(o.registration_deadline,o.starts) >= ${registrationToday} as accepting
    from outing_photos p join outings o on o.id=p.outing_id where p.id=${id} and p.position is not null`;
  const publiclyAccessible = !!photo&&allowsPublicOuting(photo as {status:string;accepting:boolean});
  const invitation = photo && !publiclyAccessible && ['abierta','confirmada'].includes(photo.status)
    ? await activeOutingInvitation(photo.outing_id, query.get('invitacion') ?? undefined) : undefined;
  const receipt = photo && !publiclyAccessible && ['abierta','confirmada'].includes(photo.status)
    ? await readRegistrationReceipt(photo.outing_id) : undefined;
  const capability={invitation:!!invitation,receipt:!!receipt};
  const allowed=photo&&(allowsPhoto(null,photo as {unit:string;status:string;accepting:boolean},capability)||allowsPhoto(await staff(),photo as {unit:string;status:string;accepting:boolean},capability));
  if (!allowed) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const [content]=await sql`select case when ${preview} then p.thumbnail else p.display_image end as bytes from outing_photos p join outings o on o.id=p.outing_id where p.id=${id} and p.position is not null and o.unit=${photo.unit} and o.status=${photo.status} and (coalesce(o.registration_deadline,o.starts)>=${registrationToday})=${photo.accepting}`;
  if(!content)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(new Uint8Array(content.bytes), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
