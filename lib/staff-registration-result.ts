import {checkedFormResult,type FormResult} from './form-result';

export type StaffRegistrationReceivedStatus='revisión'|'espera';
export type StaffRegistrationAddedResult=FormResult<string,{status:StaffRegistrationReceivedStatus}>;

/** Newly received requests have these states; historical/edit states stay separate. */
export function isStaffRegistrationReceivedStatus(value:unknown):value is StaffRegistrationReceivedStatus{
 return value==='revisión'||value==='espera';
}

/** Preserve the required status after validating the shared feedback contract. */
export function checkedStaffRegistrationAddedResult(value:unknown):StaffRegistrationAddedResult{
 const result=checkedFormResult(value);
 if(result.saved!==true)return result;
 if(typeof value==='object'&&value!==null&&'status'in value&&isStaffRegistrationReceivedStatus(value.status))
  return {...result,status:value.status};
 return {error:'No se pudo confirmar el estado de la inscripción. Los datos se conservan. Revisá la lista antes de reintentar.'};
}
