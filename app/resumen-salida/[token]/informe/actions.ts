'use server';
import type {FormResult} from "../../../../lib/form-result";
import type {ReportSubmissionResult} from "../../../../lib/report-result";
import * as reports from "../../../actions/reports";

export async function submitReport(token: string, _previous: FormResult, form: FormData): Promise<ReportSubmissionResult> {
  return reports.submitReport(token,_previous,form);
}
