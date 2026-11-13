'use server';
import type {FormResult} from "../../lib/form-result";
import * as registrations from "../actions/registrations";

export async function findRegistrationVolunteers(outingId: string, query: string) {
  return registrations.findRegistrationVolunteers(outingId,query);
}

export async function addRegistration(outingId: string, form: FormData): Promise<FormResult & {status?:string}> {
  return registrations.addRegistration(outingId,form);
}
