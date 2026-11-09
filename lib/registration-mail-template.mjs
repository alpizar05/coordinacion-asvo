const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? value.split('-').reverse().join('/') : 'Por confirmar';

export const registrationStatusLabels = {
  revisión: 'En revisión · con cupo reservado', espera: 'Lista de espera',
  confirmada: 'Confirmada', rechazada: 'Rechazada',
  'cancelada por coordinación': 'Cancelada por Coordinación',
  'cancelada por voluntariado': 'Cancelada por voluntariado',
};

export function registrationMailTemplate({ entry, message, url, origin }) {
  const link = new URL(url);
  const site = new URL(origin);
  if (!['http:', 'https:'].includes(site.protocol) || link.origin !== site.origin ||
      !link.pathname.startsWith('/privado/')) throw new Error('Enlace de inscripción inválido.');
  const status = registrationStatusLabels[entry.status] || entry.status;
  const title = entry.status === 'confirmada' ? 'Tu inscripción está confirmada'
    : entry.status === 'espera' ? 'Tu inscripción está en lista de espera'
    : entry.status === 'revisión' ? 'Tu inscripción está en revisión'
    : entry.status === 'rechazada' ? 'Actualización de tu inscripción'
    : entry.status.startsWith('cancelada') ? 'Tu inscripción fue cancelada' : 'Actualización de tu inscripción';
  const next = entry.status === 'confirmada'
    ? 'Tu participación está confirmada. Consultá los detalles de tu inscripción y mantenete pendiente de las indicaciones de Coordinación.'
    : entry.status === 'revisión'
    ? 'Tenés un cupo reservado. Coordinación revisará tu inscripción y te enviará un correo cuando confirme tu participación.'
    : entry.status === 'espera'
    ? 'Por ahora no tenés un cupo reservado. Si se libera un espacio y te corresponde por orden de espera, recibirás una actualización por correo.'
    : 'Podés consultar el estado y el mensaje de Coordinación desde el enlace privado de tu inscripción.';
  const name = [entry.name, entry.surname, entry.second_surname].filter(Boolean).join(' ') || 'participante';
  const rows = [['Convocatoria',entry.title],['Lugar',entry.location],['Unidad',entry.unit],
    ['Llegada',date(entry.starts)],['Regreso',date(entry.ends)]];
  const body = `ASVO · Coordinación de Voluntariado\n\n¡Hola, ${name}!\n\n${title}\nEstado: ${status}\n${message}\n\n${rows.filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join('\n')}\n\n¿Qué sigue?\n${next}\n\nVer mi inscripción:\n${url}\n\nEste enlace es personal. No lo compartás: permite consultar tu inscripción y las acciones disponibles para editar o cancelar.\n\n¡Gracias por ser parte del voluntariado de ASVO!\nCoordinación de Voluntariado ASVO`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f5ef;color:#080907;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5ef"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fefefe;border:1px solid #d4d8d0;border-radius:12px">
<tr><td align="center" style="padding:28px 24px;border-bottom:4px solid #658048">
<img src="${escape(new URL('/logo-asvo.png',site).href)}" width="160" alt="ASVO" style="display:block;width:160px;max-width:100%;height:auto;border:0">
<p style="margin:16px 0 0;font-size:12px;color:#526a3d;letter-spacing:1px">COORDINACIÓN DE VOLUNTARIADO</p></td></tr>
<tr><td style="padding:28px 24px;font-size:15px;line-height:1.7">
<p style="margin:0 0 16px">¡Hola, <strong>${escape(name)}</strong>!</p>
<h1 style="font-size:24px;line-height:1.3;margin:0 0 20px;color:#526a3d">${escape(title)}</h1>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:16px;background:#f3f5ef;border-left:4px solid #658048">
<p style="margin:0 0 8px;font-size:12px;color:#526a3d;font-weight:bold">ESTADO DE TU INSCRIPCIÓN</p>
<p style="margin:0;font-size:17px;font-weight:bold">${escape(status)}</p></td></tr></table>
<p style="margin:20px 0;white-space:pre-line">${escape(message).replace(/\r?\n/g,'<br>')}</p>
<h2 style="font-size:18px;margin:24px 0 12px">Detalles de tu inscripción</h2>
<table width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;border-collapse:collapse">${rows.filter(([,v])=>v).map(([k,v])=>`<tr><th scope="row" align="left" valign="top" style="width:32%;padding:10px 12px 10px 0;border-bottom:1px solid #d4d8d0;color:#6f716d;font-weight:normal">${escape(k)}</th><td style="padding:10px 0;border-bottom:1px solid #d4d8d0;font-weight:bold;overflow-wrap:anywhere">${escape(v)}</td></tr>`).join('')}</table>
<h2 style="font-size:18px;margin:24px 0 8px">¿Qué sigue?</h2><p style="margin:0 0 24px">${escape(next)}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#526a3d" style="border-radius:6px"><a href="${escape(link.href)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-weight:bold">Ver mi inscripción</a></td></tr></table>
<p style="font-size:12px;color:#6f716d;margin:16px 0">Este enlace es personal. No lo compartás: permite consultar tu inscripción y las acciones disponibles para editar o cancelar.</p>
<p style="font-size:12px;margin:0;overflow-wrap:anywhere;word-break:break-all">Si el botón no funciona, copiá este enlace:<br><a href="${escape(link.href)}" style="color:#526a3d">${escape(link.href)}</a></p>
<p style="margin:28px 0 16px;color:#526a3d;font-weight:bold">¡Gracias por ser parte del voluntariado de ASVO!</p>
<p style="margin:0;font-size:14px"><strong>Coordinación de Voluntariado ASVO</strong><br>Asociación de Voluntarios para el Servicio en las Áreas Protegidas</p>
</td></tr><tr><td align="center" style="padding:20px;background:#f3f5ef;border-top:1px solid #d4d8d0;font-size:12px;line-height:1.6;color:#6f716d">Mensaje automático sobre tu inscripción de voluntariado.</td></tr>
</table></td></tr></table></body></html>`;
  return { body, html, subject: `ASVO · ${entry.title} · ${status}` };
}
