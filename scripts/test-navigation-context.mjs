// Backward-compatible entry point; the unit suite has no database/network dependencies.
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const result=spawnSync(process.execPath,['--test','--import','./tests/navigation/register.mjs',...readdirSync(new URL('../tests/navigation/',import.meta.url)).filter(name=>name.endsWith('.test.mjs')).map(name=>'tests/navigation/'+name)],{stdio:'inherit',cwd:new URL('..',import.meta.url)});
process.exitCode=result.status??1;
