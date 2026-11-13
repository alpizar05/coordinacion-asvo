import {formText,scalarInputErrors} from './form-input';
import type {FieldErrors} from './form-result';
export type OutingDecision='agrupación'|'completar'|'cancelar-salida'|'eliminar';
export function validateOutingDecision(form:FormData,action:string):FieldErrors{
 const errors:FieldErrors={},reason=formText(form,'reason');
 if(['agrupación','cancelar-salida'].includes(action)&&(!reason||reason.length>4000))errors.reason='Indicá un motivo de hasta 4000 caracteres.';
 if(action==='completar'&&form.get('confirmCompleted')!=='on')errors.confirmCompleted='Confirmá que la actividad se realizó.';
 if(action==='eliminar'&&form.get('confirmDelete')!=='on')errors.confirmDelete='Confirmá que querés eliminar esta convocatoria.';
 return {...errors,...scalarInputErrors(form,['reason','confirmCompleted','confirmDelete'])};
}
