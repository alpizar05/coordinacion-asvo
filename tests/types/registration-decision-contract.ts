import type {FormResult} from '../../lib/form-result';
import {assignRegistration70,changeRegistrationStatus} from '../../lib/registration-workflow';
declare const assign:Awaited<ReturnType<typeof assignRegistration70>>;
declare const change:Awaited<ReturnType<typeof changeRegistrationStatus>>;
const results:FormResult[]=[assign,change];
// @ts-expect-error No legacy undefined success.
const missing:typeof assign=undefined;
// @ts-expect-error No legacy error strings.
const legacy:typeof change='Error';
void [results,missing,legacy];
