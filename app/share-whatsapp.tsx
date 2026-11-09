import { appUrl } from '../lib/db';

export function ShareWhatsApp({ path, message }: { path: string; message: string }) {
  const url = new URL(path, appUrl());
  const text = encodeURIComponent(`${message}\n${url.href}`);

  return <a className="button share-whatsapp" href={`https://wa.me/?text=${text}`}
    target="_blank" rel="noopener noreferrer">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"
        stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9 7 1.5 3-1.2 1c.8 1.6 2 2.8 3.7 3.6l1-1.2 3 1.5c0 1.3-1 2.1-2.3 2.1C11.1 17 7 12.9 7 9.3 7 8 7.8 7 9 7Z"
        fill="currentColor" />
    </svg>
    Compartir por WhatsApp
  </a>;
}
