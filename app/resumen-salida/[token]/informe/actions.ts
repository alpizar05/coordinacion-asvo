'use server';
import type {FormResult} from "../../../../lib/form-result";
import * as reports from "../../../actions/reports";

export async function submitReport(token: string, _previous: FormResult, form: FormData): Promise<FormResult> {
  return reports.submitReport(token,_previous,form);
}
