import { authDiagnostics } from './auth-diagnostics';

export async function graphDiagnostic(stage: 'sharepoint-auth' | 'sharepoint-upload', response: Response) {
  let graphCode: string | undefined;
  let codes: string[] = [];
  try {
    const data = await response.clone().json();
    const rawCode = data?.error?.code;
    if (typeof rawCode === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(rawCode)) graphCode = rawCode;
    codes = authDiagnostics(Object.assign(new Error(), { cause: data })).codes;
  } catch { /* No raw response is logged. */ }
  console.error('[sharepoint][diagnostic]', JSON.stringify({ stage, status: response.status, graphCode, codes }));
}
