import {contracts} from '../tests/integration/manifest.mjs';
import {cleanTestEnvironment,runScript} from '../tests/test-process.mjs';
for(const file of contracts)await runScript(file,cleanTestEnvironment());
console.log('OK: inventario de autorización y contratos Auth.js/correo con dobles; sin base, credenciales ni servicios reales.');
