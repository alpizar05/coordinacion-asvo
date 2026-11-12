import {validFormDate as validDate} from './form-dates.mjs';
import type { FieldErrors } from './form-result';

export const profileFieldLabels = {
  name: 'Nombre', surname: 'Primer apellido', second_surname: 'Segundo apellido',
  email: 'Correo', birth: 'Fecha de nacimiento', whatsapp: 'WhatsApp',
  province: 'Provincia', canton: 'Cantón', district: 'Distrito',
  emergency_name: 'Nombre del contacto de emergencia', emergency_phone: 'Teléfono de emergencia', emergency_relation: 'Parentesco',
  volunteer_year: 'Inicio del voluntariado (AAAA)', member_year: 'Ingreso como persona asociada (AAAA)',
  medical: 'Condición médica', member: 'Persona asociada', medical_detail: 'Detalle médico',
} as const;
export type ProfileField = keyof typeof profileFieldLabels;
export type ProfileInitial = Record<ProfileField, string>;

/** Pure validator shared with the server; contains no credentials, DB or browser dependencies. */
export function validateProfile(form: FormData): FieldErrors<ProfileField> {
  const value = (name: ProfileField) => String(form.get(name) ?? '').trim();
  const errors: FieldErrors<ProfileField> = {};
  if (!value('name')) errors.name = 'Ingresá el nombre.';
  if (!value('surname')) errors.surname = 'Ingresá el primer apellido.';
  if (value('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email'))) errors.email = 'Ingresá un correo válido, por ejemplo nombre@dominio.com.';
  if (value('birth') && !validDate(value('birth'))) errors.birth = 'Indicá una fecha de nacimiento válida.';
  for (const name of ['volunteer_year','member_year'] as const) {
    if (value(name) && !/^[1-9][0-9]{3}$/.test(value(name))) errors[name] = 'Ingresá un año de cuatro dígitos, por ejemplo 2026.';
  }
  for (const name of ['member','medical'] as const) {
    if (!['','sí','no'].includes(value(name))) errors[name] = 'Elegí Sí, No o Por confirmar.';
  }
  if (value('medical') === 'sí' && !value('medical_detail')) errors.medical_detail = 'Describí la condición médica indicada.';
  return errors;
}
