'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function BriefRefresh() {
  const router = useRouter();
  const [pending,startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? 'Actualizando…' : 'Actualizar'}</button>;
}
