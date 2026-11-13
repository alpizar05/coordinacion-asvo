import { spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
import { coverageModules } from '../tests/unit/modules.mjs';
const args=process.argv.slice(2),coverage=args.includes('--coverage');
const group=args.find(arg=>arg.startsWith('--group='))?.slice(8);
const groups={'form-feedback':'feedback.test.mjs','mail-template':'mail-template.test.mjs','mail-cron':'mail-cron.test.mjs'};
if(args.some(arg=>arg!=='--coverage'&&!arg.startsWith('--group='))||(group&&!groups[group]))throw Error('Usá test:unit o test:unit:coverage.');
const files=group?['tests/unit/'+groups[group]]:['tests/unit/','tests/navigation/'].flatMap(folder=>readdirSync(new URL('../'+folder,import.meta.url)).filter(name=>name.endsWith('.test.mjs')).map(name=>folder+name));
const options=['--test','--test-concurrency=1','--import','./tests/unit/register.mjs'];
if(coverage){
 mkdirSync(new URL('../coverage/',import.meta.url),{recursive:true});
 options.push('--experimental-test-coverage',...coverageModules.map(path=>'--test-coverage-include='+path),
  '--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter=lcov','--test-reporter-destination=coverage/unit.lcov');
}
// An allowlist, not a copy of process.env: no inherited DB, Microsoft or other credentials.
const env={TZ:'UTC',LANG:'C.UTF-8'};
for(const name of ['PATH','SystemRoot','WINDIR','TMP','TEMP','TMPDIR'])if(process.env[name])env[name]=process.env[name];
const result=spawnSync(process.execPath,[...options,...files],{cwd:new URL('../',import.meta.url),env,stdio:'inherit'});
if(result.error)throw result.error;process.exitCode=result.status??1;
if(coverage&&process.exitCode===0){const {summarizeCoverage}=await import('./unit-coverage-report.mjs');await summarizeCoverage();}
