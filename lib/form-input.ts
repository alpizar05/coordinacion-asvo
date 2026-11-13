import type {FieldErrors} from './form-result';

/** A scalar control is text, never a File or an ambiguous repeated value. */
export function formText(form:FormData,name:string):string {
  const values=form.getAll(name);
  return values.length===1&&typeof values[0]==='string'?values[0].trim():'';
}
export function scalarInputErrors(form:FormData,names:readonly string[]):FieldErrors {
  const errors:FieldErrors={};
  for(const name of names){const values=form.getAll(name);if(values.length>1||values.some(value=>typeof value!=='string'))errors[name]='Revisá el valor de este campo.';}
  return errors;
}
export function textValues(form:FormData,name:string):string[]{
  return form.getAll(name).map(value=>typeof value==='string'?value:'');
}

/** Legacy registry/import identifiers retain their authorized normalization. */
export const historicalIdentification=(value:string)=>value.trim().toUpperCase().replace(/[\s-]/g,'');
