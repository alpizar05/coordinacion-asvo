let slots=[],cursor=0,effects=[];
export function begin(){cursor=0;effects=[];}
export function flush(){for(const effect of effects)effect();effects=[];}
export function reset(){for(const s of slots)s?.cleanup?.();slots=[];begin();}
export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value;}];}
export function useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];}
export function useId(){const i=cursor++;return 'identity-test-'+i;}
export function useEffect(fn,deps){const i=cursor++,before=slots[i];if(!before||deps.some((d,j)=>d!==before.deps[j])){before?.cleanup?.();const slot=slots[i]={deps};effects.push(()=>{slot.cleanup=fn();});}}
export function jsx(type,props){return {type,props};}export const jsxs=jsx,Fragment='fragment';
export function useRouter(){return {replace(){throw Error('Lookup must not navigate');}};}
export function useFormFeedback(){return {fieldErrors:{},changed(){},summary:{current:null},reset(){},showErrors(){throw Error('Lookup must not move focus or replace submit errors');}};}
export function FormFeedbackProvider(){}export function FormErrorSummary(){}export function FormField(){}export function RegistrationResultModal(){}
