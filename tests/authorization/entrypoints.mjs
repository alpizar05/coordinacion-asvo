/** Surface inventory: exact public exports, including compatibility delegates. Not an authorization proof. */
export const entrypoints={
 'app/staff-actions.ts':{
  login:'session.login',logout:'session.logout',grant:'permissions.manage',createOuting:'outings.create',manageOuting:'outings.manage',splitOutingGroup:'outings.manage',manageEntry:'registrations.manage',
  verifyPolicy:'policies.verify',importPreview:'volunteers.import',applyImportRows:'volunteers.import',editProfile:'volunteers.correct',updateVolunteerUnits:'volunteers.units',previewPolicies:'policies.import',applyPolicyRows:'policies.import',recordVolunteerIncident:'volunteers.incident',
  createOutingCollection:'series.create',createOutingInvitation:'invitations.generate',updateAutomaticCollection:'series.common-edit',saveAutomaticCollection:'series.common-edit',setHomepageFeature:'series.feature',
 },
 'app/photo-actions.ts':{managePhoto:'photos.manage',attachOutingPhoto:'photos.manage'},
 'app/public-actions.ts':{register:'public.registration',submitPrivateRegistration:'private.registration',privateAction:'private.registration'},
 'app/coordinacion/add-registration-actions.ts':{findRegistrationVolunteers:'registrations.add',addRegistration:'registrations.add'},
 'app/coordinacion/edit-registration-actions.ts':{loadEditableRegistration:'registrations.manage',saveEditedRegistration:'registrations.manage'},
 'app/coordinacion/manage-registration-actions.ts':{manageRegistration:'registrations.manage'},
 'app/coordinacion/registration-detail-actions.ts':{loadRegistrationDetail:'registrations.read'},
 'app/coordinacion/attendance-actions.ts':{reconcileAttendance:'attendance.reconcile'},
 'app/coordinacion/report-reminder-actions.ts':{sendReportReminder:'reports.remind'},
 'app/coordinacion/outing-decision-actions.ts':{decideOuting:'outings.manage'},
 'app/coordinacion/salidas/[id]/editor-action.ts':{saveOutingEdit:'outings.manage'},
 'app/coordinacion/salidas/[id]/resumen/actions.ts':{generateBrief:'briefs.generate',revokeBrief:'briefs.revoke'},
 'app/resumen-salida/[token]/informe/actions.ts':{submitReport:'private.report'},
 'app/api/fotos/[id]/route.ts':{GET:'photos.capability-read'},
 'app/api/cron/correos/route.ts':{GET:'automation.cron'},
 'app/api/auth/[...nextauth]/route.ts':{GET:'provider.auth',POST:'provider.auth'},
};
