import { notFound } from 'next/navigation';
import { canOperate, staff } from '../../../lib/auth';
import { demo, sql } from '../../../lib/db';

export default async function Page() {
  if (!demo || !canOperate(await staff())) notFound();
  const mail = await sql`select * from demo_mail order by id desc limit 30`;
  return <><h1>Bandeja de prueba</h1><p>Mensajes locales para datos ficticios.</p>
  {mail.map(row => <article className="card" key={row.id}><p>{row.recipient}</p>{row.subject && <h2>{row.subject}</h2>}{row.body && <p className="copy">{row.body}</p>}<a href={row.url}>Abrir enlace privado de prueba</a></article>)}</>;
}
