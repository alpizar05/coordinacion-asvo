// Run with --env-file=.env.production.local. Never prints credentials or tokens.
const client = process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim();
const secret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();
const tenant = issuer?.match(/^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/i)?.[1];
const reasons = {
  7000215: 'Microsoft rechazó el secreto. Comprobá su valor y que corresponda a esta aplicación.',
  7000222: 'El secreto de la aplicación venció.',
  7000218: 'Microsoft no recibió un secreto de cliente válido en la solicitud.',
  700016: 'La aplicación no fue encontrada en ese directorio. Revisá el Client ID y el Tenant ID.',
  90002: 'El directorio indicado no fue encontrado.',
  7000112: 'La aplicación está deshabilitada en Microsoft Entra.',
};

if (!client || !secret || !tenant) {
  console.error('Faltan credenciales o el ISSUER no tiene el formato https://login.microsoftonline.com/TENANT_ID/v2.0.');
  console.error('Configurá AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET y AUTH_MICROSOFT_ENTRA_ID_ISSUER en el archivo privado.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      body: new URLSearchParams({ client_id: client, client_secret: secret,
        grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (response.ok && typeof data.access_token === 'string') {
      console.log('OK: Microsoft aceptó el Client ID, el directorio y el secreto mediante client_secret_post.');
      console.log('No se imprimió ni guardó el token. Esto verifica las credenciales, no el inicio de sesión de una persona.');
    } else {
      const codes = Array.isArray(data.error_codes) ? data.error_codes.filter(code => Number.isSafeInteger(code)) : [];
      console.log('Microsoft respondió HTTP ' + response.status + '.');
      console.log('Códigos: ' + (codes.map(code => 'AADSTS' + code).join(', ') || 'sin código AADSTS'));
      if (typeof data.error === 'string' && /^[a-z_]{1,60}$/.test(data.error)) console.log('Error: ' + data.error);
      for (const code of codes) if (reasons[code]) console.log(reasons[code]);
      console.log('No se imprimieron credenciales, tokens ni la respuesta completa.');
      process.exitCode = 1;
    }
  } catch {
    console.error('No se pudo completar la consulta a Microsoft. Revisá la conexión e intentá nuevamente.');
    process.exitCode = 1;
  }
}
