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

// Actual producers, including their bound signatures. Type-only checks do not call
// actions, load credentials or execute services during this fixture's compilation.
import type {editProfile,updateVolunteerUnits,verifyPolicy,recordVolunteerIncident} from '../../app/actions/volunteers';
import type {reconcileAttendance} from '../../app/actions/reports';
import type {sendReportReminder} from '../../app/actions/communications';
import type {splitOutingGroup} from '../../app/actions/outings';
import type {RegistryForm} from '../../app/coordinacion/registry-form';
declare const profile:typeof editProfile;
declare const units:typeof updateVolunteerUnits;
declare const policy:typeof verifyPolicy;
declare const attendance:typeof reconcileAttendance;
declare const reminder:typeof sendReportReminder;
declare const split:typeof splitOutingGroup;
acceptAction(profile.bind(null,'fictitious-id'));
acceptAction(units.bind(null,'fictitious-id'));
acceptAction(policy);
acceptAction(attendance.bind(null,'fictitious-outing','fictitious-person'));
acceptAction(reminder.bind(null,'fictitious-outing','fictitious-registration'));
acceptAction(split.bind(null,'fictitious-outing','2035-01-01','2035-01-02'));
declare const inlineAction:Parameters<typeof RegistryForm>[0]['action'];
acceptAction(inlineAction);
declare const incident:typeof recordVolunteerIncident;
acceptAction(incident.bind(null,'fictitious-person'));
import type {grant} from '../../app/actions/administration';
declare const grantPermissions:typeof grant;
acceptAction(grantPermissions);
// @ts-expect-error Inline wrappers must not weaken the same producer boundary.
const legacyInline:Parameters<typeof RegistryForm>[0]['action']=async()=>undefined;
// @ts-expect-error The wrapper must not accept a synchronous mutation callback.
acceptAction(()=>({saved:true}));
void legacyInline;
