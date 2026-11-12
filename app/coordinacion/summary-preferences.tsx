'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { navigationDestination } from '../../lib/navigation-context';

export function SummaryPreferences({ subject, unit, days, tab, explicit }: { subject: string; unit: string; days: number; tab: string; explicit: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const key = `asvo-summary-v1:${subject}`;
    try {
      if (!explicit) {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (saved && typeof saved.unit === 'string' && [7,14,30].includes(saved.days) && ['revision','sin70','informes'].includes(saved.tab)) {
          const destination = `/coordinacion?${new URLSearchParams({ unidad:saved.unit,dias:String(saved.days),pestana:saved.tab })}`;
          window.dispatchEvent(new CustomEvent('asvo:page-corrected',{detail:navigationDestination(destination)}));
          router.replace(destination,{scroll:false});
          return;
        }
      }
      localStorage.setItem(key,JSON.stringify({unit,days,tab}));
    } catch { /* Preferences are optional on shared or restricted browsers. */ }
    if(!explicit){
      const destination = `/coordinacion?${new URLSearchParams({unidad:unit,dias:String(days),pestana:tab})}`;
      window.dispatchEvent(new CustomEvent('asvo:page-corrected',{detail:navigationDestination(destination)}));
      window.history.replaceState(null,'',destination);
    }
  },[subject,unit,days,tab,explicit,router]);
  return null;
}

export function SummaryRefresh() {
  const router = useRouter();
  return <button type="button" onClick={() => router.refresh()}>Actualizar</button>;
}
