import { timingSafeEqual } from 'node:crypto';

export async function handleMailCron(request: Request, options: {
  secret: string | undefined;
  enabled: boolean;
  flush: () => Promise<{ sent: number; failed: number }>;
}) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!options.secret) return Response.json({ error: 'Cron no configurado.' }, { status: 503, headers });
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${options.secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: 'No autorizado.' }, { status: 401, headers });
  }
  if (!options.enabled) return Response.json({ error: 'Cron deshabilitado en este entorno.' }, { status: 503, headers });
  try {
    const result = await options.flush();
    console.info('[mail-cron]', JSON.stringify(result));
    return Response.json(result, { status: result.failed ? 503 : 200, headers });
  } catch {
    console.error('[mail-cron] No se pudo procesar la cola.');
    return Response.json({ error: 'No se pudo procesar la cola.' }, { status: 503, headers });
  }
}
