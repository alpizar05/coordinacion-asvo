import type {StaffRegistrationAddedResult} from '../../lib/staff-registration-result';
import type {FormResult} from '../../lib/form-result';
import type {addRegistration,saveEditedRegistration} from '../../app/actions/registrations';
import type * as compatible from '../../app/coordinacion/add-registration-actions';
const review:StaffRegistrationAddedResult={saved:true,status:'revisión'};
const waiting:StaffRegistrationAddedResult={saved:true,status:'espera'};
const both:StaffRegistrationAddedResult={error:'General',fieldErrors:{volunteer:['Uno','Dos'],ends:'Fecha'}};
// @ts-expect-error A confirmed add must include its received state.
const absent:StaffRegistrationAddedResult={saved:true};
// @ts-expect-error Adding a received request never claims confirmation.
const confirmed:StaffRegistrationAddedResult={saved:true,status:'confirmada'};
// @ts-expect-error Saved must be a literal boolean.
const truthy:StaffRegistrationAddedResult={saved:'true',status:'revisión'};
// @ts-expect-error Success and errors cannot coexist.
const contradictory:StaffRegistrationAddedResult={saved:true,status:'espera',error:'Falló'};
declare const canonical:typeof addRegistration;
declare const legacy:typeof compatible.addRegistration;
const canonicalContract:(id:string,form:FormData)=>Promise<StaffRegistrationAddedResult>=canonical;
const legacyContract:typeof canonical=legacy;
declare const edit:typeof saveEditedRegistration;
const editContract:(id:string,form:FormData)=>Promise<FormResult>=edit;
void [review,waiting,both,absent,confirmed,truthy,contradictory,canonicalContract,legacyContract,editContract];
