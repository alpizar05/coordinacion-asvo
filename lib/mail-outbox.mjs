/** @param {import('postgres').Sql} sql */
export async function flushRegistrationMail(sql, { budgetMs = 35000 } = {}) {
  const deadline = Date.now() + budgetMs;
  const result = { sent: 0, failed: 0 };
  for (let index = 0; index < 30; index++) {
    // Reserve time for one complete Graph request before the function ends.
    if (Date.now() + 22000 > deadline) break;
    const [mail] = await sql`update registration_mail_outbox set attempts=attempts+1,retry_at=now()+interval '5 minutes'
      where id=(select pending.id from registration_mail_outbox pending where pending.sent_at is null and pending.retry_at<=now()
        and not exists (select 1 from registration_mail_outbox earlier where earlier.registration_id=pending.registration_id
          and earlier.id<pending.id and earlier.sent_at is null)
        order by pending.id for update of pending skip locked limit 1)
      returning id,recipient,subject,body,html_body`;
    if (!mail) break;
    try {
      const tenant = process.env.GRAPH_TENANT_ID;
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant || '')}/oauth2/v2.0/token`, {
        method: 'POST',
        body: new URLSearchParams({ client_id: process.env.GRAPH_CLIENT_ID || '', client_secret: process.env.GRAPH_CLIENT_SECRET || '',
          scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
        signal: AbortSignal.timeout(8000),
      });
      if (!tokenResponse.ok) throw new Error('Graph rechazó la autenticación.');
      const { access_token } = await tokenResponse.json();
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env.GRAPH_SENDER || '')}/sendMail`, {
        method: 'POST', headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { subject: mail.subject, body: {
          contentType: mail.html_body ? 'HTML' : 'Text', content: mail.html_body || mail.body },
          toRecipients: [{ emailAddress: { address: mail.recipient } }] } }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('Graph rechazó el correo.');
      await sql`update registration_mail_outbox set sent_at=now() where id=${mail.id}`;
      result.sent++;
    } catch {
      result.failed++;
      console.error('Correo de inscripción pendiente de reintento.', mail.id);
      break;
    }
  }
  return result;
}
