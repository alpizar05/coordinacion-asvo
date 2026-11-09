'use client';

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';

const preferenceKey = 'asvo-catalog-columns';
const options = [3, 4, 5] as const;

export function ConvocationsGrid({ children }: { children: ReactNode }) {
  const [columns, setColumns] = useState<number>(3);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(preferenceKey));
      if (options.some(option => option === saved)) setColumns(saved);
    } catch { /* The layout selector also works without browser storage. */ }
  }, []);

  return <section aria-labelledby="mas-convocatorias" className="home-catalog">
    <div className="home-catalog-heading">
      <h2 id="mas-convocatorias">Más convocatorias</h2>
      <div className="catalog-layout-selector" role="group" aria-label="Tarjetas por fila">
        {options.map(option => <button key={option} type="button" aria-pressed={columns === option}
          aria-label={`${option} tarjetas por fila`} aria-controls="home-catalog-grid"
          onClick={() => {
            setColumns(option);
            try { localStorage.setItem(preferenceKey, String(option)); } catch { /* Optional preference. */ }
          }}>
          <svg width="24" height="18" viewBox="0 0 30 18" fill="currentColor" aria-hidden="true">
            {Array.from({ length: option }, (_, index) => <rect key={index}
              x={index * (30 / option)} y="1" width={30 / option - 2} height="16" rx="1" />)}
          </svg>
        </button>)}
      </div>
    </div>
    <div id="home-catalog-grid" className="grid home-catalog-grid"
      style={{ '--catalog-columns': columns } as CSSProperties}>{children}</div>
  </section>;
}
