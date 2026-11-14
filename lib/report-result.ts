import type {FormResult} from './form-result';
import type {ReportField} from './outing-report-validation';

export type ReportStatus = 'borrador' | 'finalizado';
export type ReportSaveResult = FormResult<ReportField, {id:string; status:ReportStatus}>;
export type ReportSubmissionResult = FormResult<ReportField, {destination:string}>;

/** Only confirmed persistence can cause invalidation/navigation. Never infer success by absence of errors. */
export function reportSubmissionResult(result:ReportSaveResult, token:string, mode:'borrador'|'finalizar'):ReportSubmissionResult {
  const unavailable = {error:'No se pudo confirmar el guardado del informe. Tus datos se conservan para reintentar.'};
  if (!result || typeof result !== 'object') return unavailable;
  if (result.saved === true) {
    if (typeof result.id !== 'string' || !result.id.trim() ||
        result.status !== (mode === 'borrador' ? 'borrador' : 'finalizado') ||
        result.error !== undefined || result.fieldErrors !== undefined) return unavailable;
    return {saved:true,destination:`/resumen-salida/${token}/informe?${mode==='borrador'?'borrador=1':'enviado=1'}`};
  }
  if (result.error || result.fieldErrors) return {error:result.error,fieldErrors:result.fieldErrors};
  return unavailable;
}

/** A query flag alone is never evidence of a saved draft or a finalized report. */
export function reportConfirmation(status:ReportStatus|undefined, query:{enviado?:string;borrador?:string}):string {
  if (status === 'finalizado' && query.enviado === '1') return 'Informe finalizado. La tarea está completada y el informe ya no se puede editar.';
  if (status === 'borrador' && query.borrador === '1') return 'Borrador guardado. Podés continuar después; el informe sigue pendiente.';
  return '';
}
