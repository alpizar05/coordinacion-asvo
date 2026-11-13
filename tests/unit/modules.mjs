// Explicit denominator. Constants, React, SQL adapters and external contracts are not measured here.
export const coverageModules = [
 'runtime-config.mjs','security-rules.mjs','security-headers.mjs','mail-attempt-rules.mjs','workflow-transitions.ts','authorization.ts','form-input.ts','photo-metadata.ts','registry-csv.ts','graph-response.mjs','form-dates.mjs','form-result.ts','profile-validation.ts','filter-validation.ts',
 'registration-validation.ts','staff-registration-validation.ts','registry-validation.ts','outing-decision-validation.ts',
 'outing-form-validation.ts','outing-report-validation.ts','outing-report-options.ts','registration-rules.ts',
 'participation-rules.ts','volunteer-search-criteria.ts','registration-logistics.ts','registration-changes.ts',
 'participation-dates.ts','outing-logistics.ts','historical-import-plan.mjs','registration-mail-template.mjs','mail-cron.ts',
 'migration-sql.mjs','local-demo.mjs',
 'navigation-context.ts','navigation-store.ts',
].map(name=>'lib/'+name);
