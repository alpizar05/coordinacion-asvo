import '../db-commands/no-network.mjs';
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import swc from 'next/dist/build/swc/index.js';
await swc.loadBindings();
const stub=new URL('./stubs.mjs',import.meta.url).href;
registerHooks({resolve(specifier,context,next){
 if(context.parentURL?.endsWith('/remember-registration.tsx')&&['react','next/navigation','./form-feedback/form-feedback','./registration-result-modal'].includes(specifier))return {url:stub,shortCircuit:true};
 if(specifier==='react/jsx-runtime')return {url:stub,shortCircuit:true};
 if(specifier.startsWith('.')&&context.parentURL&&!/\.[a-z]+$/.test(specifier))for(const suffix of ['.ts','.tsx']){const url=new URL(specifier+suffix,context.parentURL);if(existsSync(url))return next(url.href,context);}
 return next(specifier,context);
},load(url,context,next){if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:swc.transformSync(readFileSync(new URL(url),'utf8'),{filename:new URL(url).pathname,jsc:{parser:{syntax:'typescript',tsx:true},target:'es2022',transform:{react:{runtime:'automatic'}}},module:{type:'es6'}}).code};return next(url,context);}});
