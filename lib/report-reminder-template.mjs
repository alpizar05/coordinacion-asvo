const escape = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function reportReminderTemplate({ name,title,starts,ends,url,origin }) {
  const message = `¡Hola, ${name}!\n\nTe recordamos presentar tu informe como 70 de la salida ${title}, realizada del ${starts.split('-').reverse().join('/')} al ${ends.split('-').reverse().join('/')}.\n\nDescribí las labores realizadas y confirmá quiénes participaron realmente.\n\n¡Gracias por tu apoyo!\nCoordinación de Voluntariado ASVO`;
  return {
    subject: `ASVO · Recordatorio de informe · ${title}`,
    body: `${message}\n\nCompletar informe de salida:\n${url}\n\nEl enlace es personal y permite acceder al resumen de participantes. No lo compartás.`,
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f3f5ef;color:#080907;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:620px;margin:auto;background:#fefefe;border:1px solid #d4d8d0;border-radius:12px"><tr><td style="padding:28px;text-align:center;border-bottom:4px solid #658048"><img src="${escape(new URL('/logo-asvo.png',origin).href)}" width="160" alt="ASVO"></td></tr><tr><td style="padding:28px;line-height:1.7"><h1 style="font-size:24px;color:#526a3d">Informe de salida pendiente</h1><p>${escape(message).replace(/\n/g,'<br>')}</p><p><a href="${escape(url)}" style="display:inline-block;padding:13px 22px;background:#526a3d;color:white;text-decoration:none;border-radius:6px;font-weight:bold">Completar informe de salida</a></p><p style="font-size:12px;color:#6f716d">Este enlace es personal y permite acceder al resumen de participantes. No lo compartás.</p><p style="font-size:12px;word-break:break-all">Si el botón no funciona:<br>${escape(url)}</p></td></tr></table></td></tr></table></body></html>`,
    preview: message,
  };
}
