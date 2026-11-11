'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StatusRibbon } from '../status-ribbon';

const messages: Record<string,string> = {
  creada: 'Convocatoria creada.',
  borrador: 'Convocatoria guardada como borrador.',
  eliminada: 'Convocatoria eliminada.',
  cancelada: 'Convocatoria cancelada. Las inscripciones activas fueron canceladas.',
  salida: 'Cambios de la convocatoria guardados.',
  agrupacion: 'Decisión de agrupación registrada.',
  foto: 'Fotos de la convocatoria actualizadas.',
  serie: 'Convocatoria en serie creada.',
  destacada: 'Convocatoria destacada en portada.',
  automatica: 'Selección automática de portada restablecida.',
};

/** Consume only our confirmation parameter; retain filters, anchors and other state. */
export function ConfirmationFromUrl() {
  const query = useSearchParams();
  const code = query.get('confirmacion');
  const [notice,setNotice] = useState({id:0,message:''});
  useEffect(() => {
    if (!code || !messages[code]) return;
    setNotice(previous=>({id:previous.id+1,message:messages[code]}));
    const url=new URL(window.location.href);
    url.searchParams.delete('confirmacion');
    window.history.replaceState(window.history.state,'',`${url.pathname}${url.search}${url.hash}`);
  },[code]);
  return <StatusRibbon key={notice.id} message={notice.message} />;
}
