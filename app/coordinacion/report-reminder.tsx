'use client';

import { ActionModal } from './action-modal';
import { sendReportReminder } from './report-reminder-actions';

export function ReportReminder({ outingId, registrationId, name, email, title, starts, ends, activeLink, demo, open, onClose }: {
  open?: boolean; onClose?: () => void;
  outingId:string; registrationId:string; name:string; email:string; title:string; starts:string; ends:string; activeLink:boolean; demo:boolean;
}) {
  return <>
    <ActionModal open={open} onClose={onClose} title={activeLink ? 'Enviar recordatorio' : 'Preparar enlace y recordar'} saveLabel="Enviar recordatorio" successMessage={demo ? 'Recordatorio disponible en Bandeja de prueba.' : 'Recordatorio registrado. Consultá su estado de envío en el seguimiento.'} action={async form => {
      const result = await sendReportReminder(outingId,registrationId,form);
      return result;
    }}>
      <p><strong>Destinatario:</strong> {name}<br />{email}</p>
      <input type="hidden" name="email" value={email} />
      <p><strong>Asunto:</strong> ASVO · Recordatorio de informe · {title}</p>
      <section className="card" aria-label="Vista previa del recordatorio">
        <p>¡Hola, {name}!</p><p>Te recordamos presentar tu informe como 70 de la salida <strong>{title}</strong>, realizada del {starts} al {ends}.</p>
        <p>Describí las labores realizadas y confirmá quiénes participaron realmente.</p>
        <p><strong>Completar informe de salida</strong> — botón con enlace privado.</p>
        <p>¡Gracias por tu apoyo!<br />Coordinación de Voluntariado ASVO</p>
      </section>
      <p className="muted">El correo incluye un enlace vigente y personal. Si hace falta, se generará uno nuevo sin invalidar otros enlaces vigentes.</p>
    </ActionModal>
  </>;
}
