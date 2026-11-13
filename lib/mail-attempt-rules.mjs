/** A response from sendMail describes acceptance only, not delivery. */
export function sendOutcome(status) {
 if(status===202)return 'accepted';
 // A gateway/server error or timeout can occur after acceptance. Treat conservatively.
 if(Number.isInteger(status)&&status>=400&&status<500&&status!==408)return 'rejected';
 return 'uncertain';
}
export function graphRequestReference(value) {
 return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value.toLowerCase():null;
}
export function retryDelayMs(value,now) {
 const seconds=typeof value==='string'&&/^\d+$/.test(value)?Number(value)*1000:Date.parse(value)-now;
 return Number.isFinite(seconds)?Math.max(300000,Math.min(seconds,86400000)):300000;
}
export function validateMailReview(input) {
 if(!/^[1-9]\d*$/.test(String(input.mailId))||!graphRequestReference(input.attemptId)||
    typeof input.actor!=='string'||! /^[a-zA-Z0-9_.:@-]{1,100}$/.test(input.actor))throw Error('Indicá correo, intento y operador válidos.');
 const expected={accepted:'acceptance_evidence',retry:'duplicate_risk_acknowledged',cancel:'cancel_after_review'};
 if(!Object.hasOwn(expected,input.decision)||input.reason!==expected[input.decision]||
   (input.decision==='accepted'&&!graphRequestReference(input.evidence))||
   (input.evidence!=null&&!graphRequestReference(input.evidence)))throw Error('Indicá decisión, motivo y evidencia válidos; reintentar exige reconocer el riesgo de duplicado.');
}
