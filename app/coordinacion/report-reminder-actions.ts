'use server';

import * as communications from "../actions/communications";

export async function sendReportReminder(outingId: string, registrationId: string, form: FormData) {
  return communications.sendReportReminder(outingId,registrationId,form);
}
