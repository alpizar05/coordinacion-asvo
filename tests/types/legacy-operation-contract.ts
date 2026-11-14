import type {FormResult} from '../../lib/form-result';
import {manageOutingRecord} from '../../lib/staff-outing-management';
import {manageLegacyEntry} from '../../lib/legacy-entry-management';
declare const outing:Awaited<ReturnType<typeof manageOutingRecord>>;
declare const entry:Awaited<ReturnType<typeof manageLegacyEntry>>;
const shared:FormResult[]=[outing,entry];
// @ts-expect-error No outcome inferred from a string.
const sentinel:typeof outing='completada';
// @ts-expect-error Success must carry a classified outcome.
const ambiguous:typeof outing={saved:true};
// @ts-expect-error Entry no longer silently returns void.
const missing:typeof entry=undefined;
void [shared,sentinel,ambiguous,missing];
