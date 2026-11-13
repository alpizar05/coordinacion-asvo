'use server';

import * as registrations from "../actions/registrations";

export async function loadRegistrationDetail(id: string) {
  return registrations.loadRegistrationDetail(id);
}
