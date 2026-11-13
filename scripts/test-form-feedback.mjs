// Compatibility entry: executes the isolated node:test suite without .env or credentials.
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['scripts/test-unit.mjs','--group=form-feedback'],{cwd:new URL('../',import.meta.url),stdio:'inherit'});
process.exitCode=result.status??1;
