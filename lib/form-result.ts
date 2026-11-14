/** Serializable server/client contract. Expected validation failures are data, not exceptions. */
export type FieldErrorValue = string | string[];
export type FieldErrors<Field extends string = string> = Partial<Record<Field, FieldErrorValue>>;
export function fieldErrorMessages(value?: FieldErrorValue): string[] {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(message=>!!message.trim());
}
export type FormResult<Field extends string = string, Success extends object = object> =
  | ({ saved: true; destination?: string; error?: never; fieldErrors?: never } & Success)
  | { saved?: false; error?: string; fieldErrors?: FieldErrors<Field>; destination?: never };

/** Consumer boundary for submitted operations, not initial form state or queries.
 * Validate the existing contract; a missing/malformed response must never close a form.
 * Payloads beyond the feedback/navigation fields are intentionally not projected here.
 */
export function checkedFormResult(value: unknown): FormResult {
  const invalid = {error:'No se pudo confirmar el guardado. Tus datos se conservan para reintentar.'};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid;
  const result: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  const {saved,error,fieldErrors,destination} = result;
  if (saved === true) {
    if (error !== undefined || fieldErrors !== undefined ||
        (destination !== undefined && typeof destination !== 'string')) return invalid;
    return {saved:true,destination};
  }
  if ((saved !== undefined && saved !== false) || destination !== undefined ||
      (error !== undefined && typeof error !== 'string')) return invalid;
  if (fieldErrors !== undefined && !isFieldErrors(fieldErrors)) return invalid;
  if (!(typeof error === 'string' && error.trim()) &&
      !Object.values(fieldErrors || {}).some(item=>fieldErrorMessages(item).length)) return invalid;
  return {error,fieldErrors};
}

function isFieldErrors(value: unknown): value is FieldErrors {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    Object.values(value).every(item=>item === undefined || typeof item === 'string' ||
      (Array.isArray(item) && item.every(message=>typeof message === 'string')));
}

/** Revalidate only the changed field; unrelated server errors remain intact. */
export function updateFieldError(errors: FieldErrors, name: string, message?: FieldErrorValue): FieldErrors {
  const next = { ...errors };
  if (fieldErrorMessages(message).length) next[name] = message;
  else delete next[name];
  return next;
}
