import type {ActionModalProps} from '../../app/coordinacion/action-modal';
import type {RegistryModal} from '../../app/coordinacion/registry-form';
import type {FormResult} from '../../lib/form-result';

// Included by the fresh-copy CI typecheck; never executed or imported by the app.
declare const acceptAction: (action:ActionModalProps['action'])=>void;
acceptAction(async()=>({saved:true}));
acceptAction(async()=>({error:'General',fieldErrors:{name:['Required','Check value'],ends:'Invalid'}}));
acceptAction(async()=>({saved:true,destination:'/coordinacion',additionalPayload:'allowed'}));
// @ts-expect-error A void promise is not a submitted-operation result.
acceptAction(async()=>{});
// @ts-expect-error Legacy strings must not cross the modal boundary.
acceptAction(async()=>'OK');
// @ts-expect-error Unknown promises require validation before acting as a producer.
acceptAction(async():Promise<unknown>=>({saved:true}));
// @ts-expect-error The discriminant is a boolean literal, not a truthy string.
acceptAction(async()=>({saved:'true'}));
declare const registryAction: Parameters<typeof RegistryModal>[0]['action'];
const sameContract:(data:FormData)=>Promise<FormResult> = registryAction;
void sameContract;
