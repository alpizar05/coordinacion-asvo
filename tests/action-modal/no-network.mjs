import '../db-commands/no-network.mjs';
// Next dev checks release/security metadata at startup. Model offline metadata,
// never a real registry call or an assertion that the installed version is secure.
// All other fetches and the impossible DB stay blocked.
const blockedFetch=globalThis.fetch;
globalThis.fetch=async(input,...args)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input?.url;
 if(url==='https://registry.npmjs.org/-/package/next/dist-tags' ||
    url==='https://registry.npmjs.org/-/npm/v1/security/advisories/bulk'){
  process.stdout.write('[test-next-metadata-offline-double]\n');
  return new Response(null,{status:503});
 }
 return blockedFetch(input,...args);
};
