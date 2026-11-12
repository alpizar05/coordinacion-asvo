import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){
 if(specifier==='./navigation-context'&&context.parentURL?.endsWith('/lib/navigation-store.ts'))return next(new URL('./navigation-context.ts',context.parentURL).href,context);
 return next(specifier,context);
}});
