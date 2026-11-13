'use server';
import type {FormResult} from "../../../../../lib/form-result";
import * as communications from "../../../../actions/communications";

export async function generateBrief(id: string, _previous: FormResult & {link?:string}, form: FormData): Promise<FormResult & {link?:string}> {
  return communications.generateBrief(id,_previous,form);
}

export async function revokeBrief(id: string) {
  return communications.revokeBrief(id);
}
