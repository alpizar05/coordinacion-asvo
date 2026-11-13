/** Limits are deliberately per identity/capability; IP is only a coarse secondary gate. */
export const abuseLimits={network:300,registration:8,privateMutation:30,report:30,windowSeconds:900};
export function normalizedAddress(value){
 if(typeof value!=='string'||value.length>64)return null;
 if(/^\d{1,3}(\.\d{1,3}){3}$/.test(value)){const parts=value.split('.');return parts.every(p=>Number(p)<=255&&String(Number(p))===p)?value:null;}
 if(!/^[0-9a-f:.]+$/i.test(value)||!value.includes(':'))return null;
 try{const host=new URL('http://['+value+']/').hostname;return host.slice(1,-1);}catch{return null;}
}
export function trustedClientAddress(env,header){
 // Never trust a caller-supplied forwarding header outside the deployed Vercel ingress.
 if(env.VERCEL!=='1'||typeof header!=='string'||header.length>1024)return null;
 return normalizedAddress(header.split(',')[0].trim());
}
