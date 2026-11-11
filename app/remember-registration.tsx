'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const savedKey = 'asvo-registration-preferences-v1';
const pendingKey = 'asvo-registration-preferences-pending-v1';
const lifetime = 90 * 24 * 60 * 60 * 1000;
type Preferences = { identification: string; transport: boolean; rides: number; food: string };
function valid(value: unknown): value is Preferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as Preferences;
  return typeof p.identification === 'string' && /^[0-9]{9}$/.test(p.identification) &&
    typeof p.food === 'string' && p.food.length <= 500 && typeof p.transport === 'boolean' && Number.isSafeInteger(p.rides) && p.rides >= 0;
}

export function RememberRegistrationForm({ action, outingId, children }: {
  action: (data: FormData) => Promise<void>; outingId: string; children: ReactNode;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [remember, setRemember] = useState(false);
  const [available, setAvailable] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(savedKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // Earlier preferences recorded availability without a seat count.
      if (saved?.data && typeof saved.data.rides === 'boolean') saved.data.rides = 0;
      if (!valid(saved.data) || typeof saved.expires !== 'number' || saved.expires <= Date.now()) {
        localStorage.removeItem(savedKey); return;
      }
      for (const name of ['identification', 'transport', 'rides', 'food'] as const) {
        const input = form.current?.elements.namedItem(name);
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
          if (typeof saved.data[name] === 'boolean' && input instanceof HTMLInputElement) input.checked = saved.data[name];
          else input.value = String(saved.data[name]);
        }
      }
      form.current?.querySelector('[name=transport]')?.dispatchEvent(new Event('change', { bubbles: true }));
      setRemember(true);
    } catch { setAvailable(false); }
  }, []);
  function forget() {
    try { localStorage.removeItem(savedKey); sessionStorage.removeItem(pendingKey); }
    catch { setAvailable(false); }
    setRemember(false);
    setMessage('Los datos guardados en este navegador se eliminaron.');
  }
  return <form ref={form} action={action} onPaste={event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.name === 'identification') {
      event.preventDefault();
      const digits = event.clipboardData.getData('text').replace(/[^0-9]/g, '');
      if (!digits) return;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      input.value = (input.value.slice(0,start) + digits + input.value.slice(end)).slice(0,9);
      const cursor = Math.min(start + digits.length,input.value.length);
      input.setSelectionRange(cursor,cursor);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }} onInput={event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.name === 'identification') {
      const cleaned = input.value.replace(/[^0-9]/g, '').slice(0,9);
      if (cleaned !== input.value) {
        const cursor = input.selectionStart ?? input.value.length;
        const position = input.value.slice(0,cursor).replace(/[^0-9]/g, '').length;
        input.value = cleaned;
        input.setSelectionRange(Math.min(position,9),Math.min(position,9));
      }
    }
  }} onSubmit={event => {
    try {
      sessionStorage.removeItem(pendingKey);
      if (!remember) return;
      const data = new FormData(event.currentTarget);
      sessionStorage.setItem(pendingKey, JSON.stringify({ outingId, created: Date.now(), data: {
        identification: String(data.get('identification') || ''), transport: data.get('transport') === 'on',
        rides: data.get('transport') === 'on' ? Number(data.get('rides') || 0) : 0, food: String(data.get('food') || ''),
      } }));
    } catch { setMessage('Este navegador no permite recordar los datos. Podés enviar tu inscripción igualmente.'); }
  }}>
    {children}
    <div className="remember-registration">
      <label><input type="checkbox" checked={remember} disabled={!available} onChange={event => {
        if (event.target.checked) { setRemember(true); setMessage(''); } else forget();
      }} /> Recordar mis datos en este dispositivo</label>
      <p className="muted">Usá esta opción solo en un dispositivo personal.</p>
      <p role="status">{message || (!available ? 'El almacenamiento de este navegador no está disponible.' : '')}</p>
    </div>
    <button type="submit">Enviar inscripción</button>
  </form>;
}

export function SaveRegistrationPreferences({ outingId }: { outingId: string }) {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(pendingKey);
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (pending.outingId !== outingId) return;
      sessionStorage.removeItem(pendingKey);
      if (!valid(pending.data) || typeof pending.created !== 'number' || pending.created > Date.now() || Date.now() - pending.created > 15 * 60 * 1000) return;
      localStorage.setItem(savedKey, JSON.stringify({ data: pending.data, expires: Date.now() + lifetime }));
    } catch { /* Browser storage is optional; registration has already succeeded. */ }
  }, [outingId]);
  return null;
}
