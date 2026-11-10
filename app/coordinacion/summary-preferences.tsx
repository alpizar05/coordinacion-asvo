'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function SummaryPreferences({ subject, unit, days, tab, explicit }: { subject: string; unit: string; days: number; tab: string; explicit: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const key = `asvo-summary-v1:${subject}`;
    try {
      if (!explicit) {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (saved && typeof saved.unit === 'string' && [7,14,30].includes(saved.days) && ['revision','sin70','informes'].includes(saved.tab)) {
          router.replace(`/coordinacion?${new URLSearchParams({ unidad:saved.unit,dias:String(saved.days),pestana:saved.tab })}`,{scroll:false});
          return;
        }
      }
      localStorage.setItem(key,JSON.stringify({unit,days,tab}));
    } catch { /* Preferences are optional on shared or restricted browsers. */ }
  },[subject,unit,days,tab,explicit,router]);
  return null;
}

export function SummaryRefresh() {
  const router = useRouter();
  return <button type="button" onClick={() => router.refresh()}>Actualizar</button>;
}
