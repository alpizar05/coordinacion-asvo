// Explicit Node CLI/test context only. Next.js itself handles server-only at build time.
import {registerHooks} from 'node:module';
if(typeof window!=='undefined')throw Error('Este adaptador es exclusivo de Node.');
registerHooks({resolve(specifier,context,next){
 if(specifier==='server-only')return next(new URL('../node_modules/next/dist/compiled/server-only/empty.js',import.meta.url).href,context);
 return next(specifier,context);
}});
