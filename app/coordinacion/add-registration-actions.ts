'use server';
import type {StaffRegistrationAddedResult} from '../../lib/staff-registration-result';
import * as registrations from "../actions/registrations";

export async function findRegistrationVolunteers(outingId: string, query: string) {
  return registrations.findRegistrationVolunteers(outingId,query);
}

export async function addRegistration(outingId: string, form: FormData): Promise<StaffRegistrationAddedResult> {
  return registrations.addRegistration(outingId,form);
}
