import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
const forbidden = new Set(['postgres','next','next-auth','server-only','node:net','node:tls','node:http','node:https','node:dns','node:dgram','node:child_process']);
registerHooks({ resolve(specifier,context,next) {
  if ([...forbidden].some(name=>specifier===name||specifier.startsWith(name+'/')) || /\/lib\/(db|auth)\.ts$|\/app\//.test(specifier))
    throw new Error(`Dependencia de infraestructura prohibida en unitarias: ${specifier}`);
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/.test(specifier)) {
    const candidate=new URL(specifier+'.ts',context.parentURL);
    if(existsSync(candidate))return next(candidate.href,context);
  }
  const resolved=next(specifier,context);
  if (/\/lib\/(db|auth)\.ts$|\/app\//.test(resolved.url))throw new Error('Una unitaria intentó importar infraestructura.');
  return resolved;
}});
globalThis.fetch=async()=>{throw new Error('Red prohibida en pruebas unitarias.');};
if (globalThis.WebSocket) globalThis.WebSocket=class { constructor(){throw new Error('Red prohibida en pruebas unitarias.');} };
