import type {FormResult} from '../../lib/form-result';
import type {ManualSeriesSaveResult,ManualSeriesCreateResult} from '../../lib/outing-series';
import {createOutingCollection} from '../../app/actions/series';
import * as legacy from '../../app/staff-actions';
declare const result:ManualSeriesSaveResult;
const shared:FormResult=result;
const action:typeof createOutingCollection=legacy.createOutingCollection;
// @ts-expect-error Created persistence requires its ID.
const missingId:ManualSeriesSaveResult={saved:true};
// @ts-expect-error Confirmed action requires a destination.
const missingDestination:ManualSeriesCreateResult={saved:true};
// @ts-expect-error Null is no longer an implicit selection conflict.
const silent:ManualSeriesSaveResult=null;
// @ts-expect-error An ID alone is not a committed result.
const bareId:ManualSeriesSaveResult='fictitious';
void [shared,action,missingId,missingDestination,silent,bareId];
