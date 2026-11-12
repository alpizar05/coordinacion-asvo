'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';

const subscribe = (callback: () => void) => {
  const media = window.matchMedia('(max-width: 700px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const snapshot = () => window.matchMedia('(max-width: 700px)').matches;

export function MobileDisclosure({ title, children, className, desktopSummary, closeOnSubmit = false, navigationDisclosure }: {
  title: string; children: ReactNode; className?: string; desktopSummary?: ReactNode; closeOnSubmit?: boolean; navigationDisclosure?: 'transporte' | 'alimentacion';
}) {
  const mobile = useSyncExternalStore(subscribe, snapshot, () => false);
  const modal = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pathname = usePathname();
  const params = useSearchParams();
  const leaving = useRef(false);
  const expanded = !!navigationDisclosure && params.get('desglose') === navigationDisclosure;
  const update = (open: boolean) => {
    if (!navigationDisclosure || leaving.current || window.location.pathname !== pathname) return;
    const url = new URL(window.location.href);
    if (open) { url.searchParams.set('desglose', navigationDisclosure); url.searchParams.set('pestana', 'logistica'); }
    else if (url.searchParams.get('desglose') === navigationDisclosure) url.searchParams.delete('desglose');
    else return;
    if (url.href !== window.location.href) window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event('asvo:results-ready'));
  };
  useEffect(() => {
    leaving.current = false;
    if (!navigationDisclosure || !mobile) return;
    if (expanded && !modal.current?.open) modal.current?.showModal();
    if (!expanded && modal.current?.open) modal.current.close();
    window.dispatchEvent(new Event('asvo:results-ready'));
  }, [expanded, mobile, navigationDisclosure, pathname]);
  useEffect(() => () => { leaving.current = true; modal.current?.close(); }, []);
  const captureLink = (event: React.MouseEvent) => {
    const link = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null;
    if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && link.pathname !== pathname) leaving.current = true;
  };
  if (!mobile) return <details className={className} open={navigationDisclosure ? expanded : undefined} onClickCapture={captureLink} onToggle={event => { if (navigationDisclosure) update(event.currentTarget.open); }}><summary>{desktopSummary ?? title}</summary>{children}</details>;
  return <div className="mobile-disclosure">
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-controls={`${id}-dialog`} aria-expanded={navigationDisclosure ? expanded : undefined} onClick={() => { if (navigationDisclosure) update(true); else modal.current?.showModal(); }}>{title}</button>
    <dialog ref={modal} id={`${id}-dialog`} className="table-filter-modal coordination-section-modal" aria-labelledby={id} data-navigation-disclosure={navigationDisclosure} onClickCapture={captureLink}
      onClose={() => { if (!leaving.current && window.location.pathname === pathname) { update(false); if (trigger.current?.getClientRects().length) trigger.current.focus({ preventScroll: true }); } }}
      onSubmitCapture={() => { if (closeOnSubmit) modal.current?.close(); }}
      onClick={event => { if (event.target === event.currentTarget) modal.current?.close(); }}>
      <header className="table-filter-heading"><h2 id={id}>{title}</h2>
        <button type="button" className="table-filter-close" aria-label={`Cerrar ${title.toLocaleLowerCase('es')}`}
          onClick={() => modal.current?.close()}>×</button>
      </header>
      <div className="coordination-section-modal-content">{children}</div>
    </dialog>
  </div>;
}
