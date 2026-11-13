import {graphAccessToken} from './graph-response.mjs';
import {graphRequestReference,sendOutcome,retryDelayMs} from './mail-attempt-rules.mjs';
/** No mailbox reads, drafts or new permissions. Correlation headers are NOT idempotency keys. */
export function graphMail({request=(...args)=>fetch(...args),env=process.env,timeoutMs=12000,now=Date.now}={}) {
 return {
  async authenticate(){
   const response=await request(`https://login.microsoftonline.com/${encodeURIComponent(env.GRAPH_TENANT_ID||'')}/oauth2/v2.0/token`,{
    method:'POST',body:new URLSearchParams({client_id:env.GRAPH_CLIENT_ID||'',client_secret:env.GRAPH_CLIENT_SECRET||'',scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(Math.min(timeoutMs,8000))});
   if(!response.ok)throw Error('Graph rechazó la autenticación.');
   return graphAccessToken(await response.json());
  },
  async send(mail,token,attempt){
   // Once invoked, transport exceptions cannot establish that Graph did not accept the request.
   const response=await request(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.GRAPH_SENDER||'')}/sendMail`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','client-request-id':attempt.client_request_id,'return-client-request-id':'true'},
    body:JSON.stringify({message:{subject:mail.subject,body:{contentType:mail.html_body?'HTML':'Text',content:mail.html_body||mail.body},toRecipients:[{emailAddress:{address:mail.recipient}}],
     internetMessageHeaders:[{name:'x-asvo-mail-attempt',value:attempt.id}]}}),signal:AbortSignal.timeout(timeoutMs)});
   return {state:sendOutcome(response.status),status:response.status,requestId:graphRequestReference(response.headers?.get('request-id')),
    retryMs:retryDelayMs(response.headers?.get('retry-after'),now())};
  },
 };
}
