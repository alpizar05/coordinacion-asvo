'use client';

import { useEffect, useRef, useState } from 'react';

export function RegistrationFields({ flexible, general, starts, ends, details = {}, arrival, departure }: {
  flexible:boolean; general:boolean; starts:string; ends:string; details?:Record<string,string | boolean | number>; arrival?:string; departure?:string
}) {
  const transport = useRef<HTMLInputElement>(null);
  const [hasTransport, setHasTransport] = useState(!!details.transporte);
  useEffect(() => {
    const input = transport.current;
    const update = () => setHasTransport(!!input?.checked);
    input?.addEventListener('change', update);
    return () => input?.removeEventListener('change', update);
  }, []);
  return <>{flexible && <div className="grid">
    <label>Llegada<input type="date" name="starts" max={ends} defaultValue={arrival ?? starts} required /></label>
    <label>Regreso<input type="date" name="ends" min={starts} defaultValue={departure ?? ends} required /></label>
  </div>}
  <label><input type="checkbox" name="transport" ref={transport} defaultChecked={!!details.transporte} onChange={event => setHasTransport(event.target.checked)}/> Tengo transporte propio</label>
  <label hidden={!hasTransport} style={!hasTransport ? { display: 'none' } : undefined}>Personas que puedo llevar<input disabled={!hasTransport} type="number" name="rides" min={0} step={1} required defaultValue={typeof details.ofreceTransporte === 'number' ? details.ofreceTransporte : 0} /></label>
  <label>Restricciones alimentarias<textarea name="food" maxLength={500} defaultValue={String(details.alimentacion || '')}/></label>
  {general && <label><input type="checkbox" name="lead" defaultChecked={!!details.interes70}/> Me interesa asumir la responsabilidad de 70</label>}
  <label>Otro detalle para esta salida<textarea name="other" maxLength={500} defaultValue={String(details.otro || '')}/></label></>;
}
