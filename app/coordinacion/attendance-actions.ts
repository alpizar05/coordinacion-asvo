'use server';

import * as reports from "../actions/reports";

export async function reconcileAttendance(outingId: string, volunteerId: string, form: FormData) {
  return reports.reconcileAttendance(outingId,volunteerId,form);
}
