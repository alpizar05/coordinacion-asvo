import type {Transaction} from './registration';
/** Inclusive coverage of the whole requested participation, shared by all three entry paths. */
export async function registrationCoverage(tx:Transaction,volunteerId:string,starts:string,ends:string){
 const [policy]=await tx`select id from policies where volunteer_id=${volunteerId} and verified_at is not null
   and starts<=${starts}::date and ends>=${ends}::date limit 1`;
 return policy;
}
