/** Test recipients must never reach Microsoft Graph, including queued retries. */
export const isTestRecipient = recipient => String(recipient ?? '').trim().toLowerCase().endsWith('.test');

/** Revalidate reminders at dispatch time; ordinary registration mail is unaffected. */
export async function reportReminderIsCurrent(sql, mailId) {
  const [reminder] = await sql`select q.id from report_reminders q where q.mail_id=${mailId}`;
  if (!reminder) return true;
  const [valid] = await sql`select 1 from report_reminders q
    join registrations r on r.id=q.registration_id join volunteers v on v.id=r.volunteer_id
    join outings o on o.id=r.outing_id join outing_brief_links l on l.digest=q.link_digest
    where q.mail_id=${mailId} and r.status='confirmada' and r.details->'assigned70'='true'::jsonb
      and o.status in ('abierta','confirmada','completada') and o.ends<(clock_timestamp() at time zone 'America/Costa_Rica')::date
      and l.outing_id=o.id and l.lead_registration_id=r.id and l.revoked_at is null and l.expires_at>clock_timestamp()
      and v.email=q.recipient and not exists(select 1 from outing_reports p where p.status='finalizado' and p.outing_id=o.id and p.lead_registration_id=r.id)`;
  return !!valid;
}

/** @param {import('postgres').Sql} sql */
export async function flushRegistrationMail(sql, { budgetMs = 35000 } = {}) {
  const deadline = Date.now() + budgetMs;
  const result = { sent: 0, failed: 0 };
  for (let index = 0; index < 30; index++) {
    // Reserve time for one complete Graph request before the function ends.
    if (Date.now() + 22000 > deadline) break;
    const [mail] = await sql`update registration_mail_outbox set attempts=attempts+1,retry_at=now()+interval '5 minutes'
      where id=(select pending.id from registration_mail_outbox pending where pending.sent_at is null and pending.cancelled_at is null and pending.retry_at<=now()
        and not exists (select 1 from registration_mail_outbox earlier where earlier.registration_id=pending.registration_id
          and earlier.id<pending.id and earlier.sent_at is null and earlier.cancelled_at is null)
        order by pending.id for update of pending skip locked limit 1)
      returning id,recipient,subject,body,html_body`;
    if (!mail) break;
    try {
      if (isTestRecipient(mail.recipient)) {
        await sql`update registration_mail_outbox set cancelled_at=now() where id=${mail.id}`;
        continue;
      }
      if (!await reportReminderIsCurrent(sql,mail.id)) {
        await sql`update registration_mail_outbox set cancelled_at=now() where id=${mail.id}`;
        continue;
      }
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
