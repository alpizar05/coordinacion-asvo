import { redirect } from 'next/navigation';
import { uuid } from '../../../lib/registration';

export const metadata = { robots: { index: false, follow: false } };

export default async function InvitationReceived({ searchParams }: { searchParams: Promise<{ salida?: string; resultado?: string }> }) {
  const { salida, resultado } = await searchParams;
  if (!salida || !uuid(salida)) redirect('/');
  const query = new URLSearchParams({ recibido: '1' });
  if (resultado) query.set('resultado', resultado);
  redirect(`/convocatorias/${salida}?${query}#inscripcion`);
}
