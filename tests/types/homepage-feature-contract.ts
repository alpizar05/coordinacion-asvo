import type {FormResult} from '../../lib/form-result';
import {saveHomepageFeature} from '../../lib/outing-series';
import {setHomepageFeature} from '../../app/actions/series';
declare const result:Awaited<ReturnType<typeof saveHomepageFeature>>;
const shared:FormResult=result;
const redirect:Promise<never>=setHomepageFeature('outing','fictitious',new FormData());
// @ts-expect-error The service cannot return a legacy success with no result.
const missing:typeof result=undefined;
// @ts-expect-error The service cannot return an error string.
const legacy:typeof result='Error';
void [shared,redirect,missing,legacy];
