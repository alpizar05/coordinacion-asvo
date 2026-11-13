import {validFormDate as date} from './form-dates.mjs';
import {labourOptions,activityOptions} from './outing-report-options';
export type ReportValues = { labour: string[]; location: string; activity: string; starts: string; ends: string;
  actions: string; host: string; observations: string };
export type ReportErrors = Partial<Record<keyof ReportValues | 'participants' | 'accuracy' | 'email' | 'form', string>>;

export function validateReport(values: ReportValues, attended: string[], accuracy: boolean, draft = false): ReportErrors {
  const errors: ReportErrors = {};
  const shapeErrors:ReportErrors={};
  const raw=values&&typeof values==='object'?values:{} as Partial<ReportValues>;
  const safe={...raw} as ReportValues;
  for(const key of ['location','activity','starts','ends','actions','host','observations'] as const){
    if(typeof raw[key]!=='string'){shapeErrors[key]='Revisá el valor de este campo.';safe[key]='';}
  }
  values=safe;
  if(!Array.isArray(attended)||attended.some(value=>typeof value!=='string')){shapeErrors.participants='Revisá la selección de participantes.';attended=[];}
  if(typeof accuracy!=='boolean')shapeErrors.accuracy='Revisá la confirmación del informe.';

  for (const key of ['location','actions','host'] as const) {
    const max = key === 'actions' ? 10000 : 500;
    if (!draft && !values[key].trim()) errors[key] = 'Completá este campo.';
    else if (values[key].length > max) errors[key] = `Usá un máximo de ${max} caracteres.`;
  }
  if (!Array.isArray(values.labour) || (!draft && !values.labour.length) || values.labour.some(value => !labourOptions.some(option => option === value))) errors.labour = 'Seleccioná al menos un tipo de labor de la lista.';
  if ((!draft || values.activity) && !activityOptions.some(option => option === values.activity)) errors.activity = 'Seleccioná un tipo de gira de la lista.';
  if ((!draft || values.starts) && !date(values.starts)) errors.starts = 'Indicá una fecha de inicio válida.';
  if ((!draft || values.ends) && !date(values.ends)) errors.ends = 'Indicá una fecha de finalización válida.';
  if (values.starts && values.ends && !errors.starts && !errors.ends && values.ends < values.starts) errors.ends = 'La fecha final no puede ser anterior a la fecha inicial.';
  if (values.observations.length > 5000) errors.observations = 'Usá un máximo de 5000 caracteres.';
  if (!draft && !attended.length) errors.participants = 'Confirmá al menos una persona que participó realmente.';
  if (!draft && !accuracy) errors.accuracy = 'Confirmá que revisaste la asistencia y la información del informe.';
  return {...errors,...shapeErrors};
}

