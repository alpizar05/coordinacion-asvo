import {checkedFormResult,type FormResult} from './form-result';
export type PhotoFailure=Exclude<FormResult,{saved:true}>&{prepared?:never};
/** Local preparation is not a committed server operation. */
export type PhotoPreparationResult={prepared:true;saved?:never;error?:never;fieldErrors?:never;destination?:never}|PhotoFailure;
export type PhotoResult=PhotoPreparationResult|FormResult;
export function checkedPhotoResult(value:unknown,operation:'prepare'|'persist'):PhotoResult{
 if(operation==='persist'){if(value&&typeof value==='object'&&'prepared'in value)return {error:'No se pudo confirmar el guardado de la foto. Tus datos se conservan.'};return checkedFormResult(value);}
 if(value&&typeof value==='object'&&!Array.isArray(value)&&'prepared'in value&&value.prepared===true&&
   !('saved'in value)&&!('error'in value)&&!('fieldErrors'in value)&&!('destination'in value))return {prepared:true};
 const result=checkedFormResult(value);
 return result.saved===true?{error:'No se pudo confirmar la preparación de la foto. Tus datos se conservan.'}:result;
}
/** Public failures of photo mutation; never infer their category from their wording. */
export class PhotoMutationError extends Error{
 readonly fieldErrors?:PhotoFailure['fieldErrors'];
 constructor(message:string,fieldErrors?:PhotoFailure['fieldErrors']){super(message);this.fieldErrors=fieldErrors;}
}
