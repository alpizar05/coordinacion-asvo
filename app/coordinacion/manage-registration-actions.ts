'use server';
import type {FormResult} from "../../lib/form-result";
import * as registrations from "../actions/registrations";

export async function manageRegistration(id:string,form:FormData):Promise<FormResult>{
  return registrations.manageRegistration(id,form);
}
