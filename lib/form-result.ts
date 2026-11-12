/** Serializable server/client contract. Expected validation failures are data, not exceptions. */
export type FieldErrorValue = string | string[];
export type FieldErrors<Field extends string = string> = Partial<Record<Field, FieldErrorValue>>;
export function fieldErrorMessages(value?: FieldErrorValue): string[] {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(message=>!!message.trim());
}
export type FormResult<Field extends string = string> =
  | { saved: true; destination?: string; error?: never; fieldErrors?: never }
  | { saved?: false; error?: string; fieldErrors?: FieldErrors<Field>; destination?: never };

/** Revalidate only the changed field; unrelated server errors remain intact. */
export function updateFieldError(errors: FieldErrors, name: string, message?: FieldErrorValue): FieldErrors {
  const next = { ...errors };
  if (fieldErrorMessages(message).length) next[name] = message;
  else delete next[name];
  return next;
}
