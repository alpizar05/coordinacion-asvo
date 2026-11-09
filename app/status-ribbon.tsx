'use client';

import { useEffect, useState } from 'react';

const duration = 4500;

export function StatusRibbon({ message, onExpire }: {
  message: string;
  onExpire?: (value: string) => void;
}) {
  const [expired, setExpired] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => {
      if (onExpire) onExpire('');
      else setExpired(message);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [message, onExpire]);

  const visible = message && message !== expired;
  return <div className="status-ribbon-region" role="status" aria-atomic="true">
    {visible && <div className="status-ribbon" key={message}>{message}</div>}
  </div>;
}
