'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export const confirmationDuration = 5000;
type Confirmation = { id: number; message: string; onExpire?: (value: string) => void };
const ConfirmationContext = createContext<((message: string, onExpire?: (value: string) => void) => void) | null>(null);

/** One confirmation surface for the portal, surviving modal closure and navigation. */
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const sequence = useRef(0);
  const [confirmation,setConfirmation] = useState<Confirmation | null>(null);
  const show = useCallback((message: string,onExpire?: (value: string) => void) => {
    setConfirmation({ id: ++sequence.current,message,onExpire });
  },[]);
  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => {
      setConfirmation(current => current?.id === confirmation.id ? null : current);
      confirmation.onExpire?.('');
    },confirmationDuration);
    return () => window.clearTimeout(timer);
  },[confirmation]);
  return <ConfirmationContext.Provider value={show}>{children}<Ribbon message={confirmation?.message || ''} eventId={confirmation?.id} /></ConfirmationContext.Provider>;
}

function Ribbon({ message,eventId }: {message:string;eventId?:number}) {
  return <div className="status-ribbon-region" role="status" aria-atomic="true">
    {message && <div className="status-ribbon" key={eventId ?? message}>{message}</div>}
  </div>;
}

/** Existing callers publish to the shared surface; public pages retain a local fallback. */
export function StatusRibbon({ message,onExpire }: {message:string;onExpire?:(value:string)=>void}) {
  const show = useContext(ConfirmationContext);
  const callback = useRef(onExpire);
  useEffect(() => { callback.current=onExpire; },[onExpire]);
  const [expired,setExpired] = useState('');
  useEffect(() => {
    if (!message) { setExpired(''); return; }
    if (show) { show(message,value=>callback.current?.(value)); return; }
    const timer=window.setTimeout(()=>{setExpired(message);callback.current?.('');},confirmationDuration);
    return ()=>window.clearTimeout(timer);
  },[message,show]);
  return show ? null : <Ribbon message={message!==expired?message:''} />;
}
