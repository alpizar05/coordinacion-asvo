import {AsyncLocalStorage} from 'node:async_hooks';
export const requestContext=new AsyncLocalStorage();
export const cookies=async()=>({get:name=>requestContext.getStore()?.cookies?.[name]===undefined?undefined:{value:requestContext.getStore().cookies[name]},set(){throw Error('Cookie writes not allowed in this test');},delete(){throw Error('Cookie writes not allowed in this test');}});
export const revalidatePath=()=>{};
export const redirect=path=>{throw Error('REDIRECT:'+path);};
export const notFound=()=>{throw Error('NOT_FOUND');};
// Only the provider transport is replaced. Actual staff(), SQL grants and policies run unchanged.
export default function NextAuth(){return {auth:async()=>null,handlers:{},signIn:async()=>{throw Error('Provider calls prohibited');},signOut:async()=>{throw Error('Provider calls prohibited');}};}
