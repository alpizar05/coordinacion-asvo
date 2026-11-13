import {requireLocalDemo} from '../../lib/local-demo.mjs';
/** Entry guard for legacy test scripts: they may only write inside a runner-created database. */
export function requireDisposableTestDatabase(env=process.env){
 const target=requireLocalDemo(env);
 if(!/^\/asvo_integration_test_[0-9a-f]{32}$/.test(target.pathname))
  throw Error('Esta prueba exige una base desechable del ejecutor. Usá npm run test:integration -- --only=GRUPO; consultá tests/README.md.');
 return target;
}
