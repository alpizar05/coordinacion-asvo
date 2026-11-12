import {validFormDate as valid} from './form-dates.mjs';
import type {FieldErrors} from './form-result';
export function validateDateFilter(from:string,to:string):FieldErrors<'desde'|'hasta'>{
 const errors:FieldErrors<'desde'|'hasta'>={};
 if(from&&!valid(from))errors.desde='Indicá una fecha Desde válida.';
 if(to&&!valid(to))errors.hasta='Indicá una fecha Hasta válida.';
 if(from&&to&&valid(from)&&valid(to)&&to<from)errors.hasta='Hasta debe ser igual o posterior a Desde.';
 return errors;
}
