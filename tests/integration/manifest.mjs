// No globs: audit which executable can receive a disposable database URL.
export const contracts=['scripts/audit-authorization.mjs','scripts/test-auth-diagnostics.mjs','scripts/test-mail-test-recipients.mjs'];
export const integrationScripts=[
 {name:'workflow-transitions',file:'scripts/test-workflow-transitions.mjs'},
 {name:'authorization',file:'scripts/test-authorization.mjs'},
 {name:'registration',file:'scripts/test-registration-workflow.mjs'},
 {name:'public-registration',file:'scripts/test-public-registration.mjs'},
 {name:'staff-forms',file:'scripts/test-staff-form-errors.mjs'},
 {name:'registry-forms',file:'scripts/test-registry-form-errors.mjs'},
 {name:'outing-forms',file:'scripts/test-outing-form-errors.mjs'},
 {name:'form-audit',file:'scripts/test-form-audit.mjs'},
 {name:'outing-editor',file:'scripts/test-outing-editor.mjs'},
 {name:'volunteer-search',file:'scripts/test-volunteer-search.mjs'},
 {name:'volunteer-participation',file:'scripts/test-volunteer-participation.mjs'},
 {name:'summary',file:'scripts/test-coordination-summary.mjs'},
 {name:'db-commands',file:'scripts/test-db-commands.mjs',ownsDatabase:true},
 {name:'schema-migrations',file:'scripts/test-schema-migrations.mjs',ownsDatabase:true},
];
