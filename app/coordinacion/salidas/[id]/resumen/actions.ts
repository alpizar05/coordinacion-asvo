'use server';
import type {FormResult} from "../../../../../lib/form-result";
import type {BriefLinkResult} from "../../../../../lib/staff-communications";
import * as communications from "../../../../actions/communications";

export async function generateBrief(id: string, _previous: FormResult & {link?:string}, form: FormData): Promise<BriefLinkResult> {
  return communications.generateBrief(id,_previous,form);
}

export async function revokeBrief(id: string): Promise<FormResult> {
  return communications.revokeBrief(id);
}
