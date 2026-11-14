import {fieldErrorMessages,type FormResult} from './form-result';
export type LegacyOutingResult=FormResult<string,{outcome:'updated'|'completed'|'deleted'}>&{issue?:'unit-conflict'};
export type LegacyEntryResult=FormResult&{back:string;flushUpdates?:true};
/** HTTP compatibility can summarize fields, but never infer outcome from their text. */
export function legacyResultMessage(result:FormResult,fallback='Revisá los datos e intentá de nuevo.'):string{
 const messages=[result.error,...Object.values(result.fieldErrors||{}).flatMap(fieldErrorMessages)].filter((message):message is string=>typeof message==='string'&&!!message.trim());
 return [...new Set(messages)].join(' ')||fallback;
}
