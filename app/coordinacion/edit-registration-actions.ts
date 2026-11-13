'use server';
import type {FormResult} from "../../lib/form-result";
import * as registrations from "../actions/registrations";

export async function loadEditableRegistration(id: string) {
  return registrations.loadEditableRegistration(id);
}

export async function saveEditedRegistration(id: string, form: FormData): Promise<FormResult> {
  return registrations.saveEditedRegistration(id,form);
}
