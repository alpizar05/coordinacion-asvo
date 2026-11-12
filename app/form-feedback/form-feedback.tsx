'use client';

import { useLayoutEffect, Children, cloneElement, createContext, useContext, useId, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import { fieldErrorMessages, updateFieldError, type FieldErrors } from '../../lib/form-result';
import './form-feedback.css';
import {createPortal} from 'react-dom';

type RevealField = (name: string) => void | Promise<void>;
type Validator = (data: FormData) => FieldErrors;

function revealForm(form:HTMLFormElement){
  // Native disclosures retain their DOM and have no React section setter.
  for(let parent=form.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
  form.dispatchEvent(new CustomEvent('asvo:reveal-form',{bubbles:true}));
}

/** Reveal controlled sections before focus; never unmount or recreate a form to handle an error. */
export async function focusFormField(form: HTMLFormElement | null, name: string, reveal?: RevealField) {
  if (!form) return false;
  revealForm(form);
  await reveal?.(name);
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const item = form.elements.namedItem(name);
  const controls = [...(item instanceof RadioNodeList ? Array.from(item) : item ? [item] : []),...Array.from(form.querySelectorAll<HTMLElement>('[data-feedback-fields]')).filter(el=>el.dataset.feedbackFields?.split(' ').includes(name))];
  const target = controls.find(control => control instanceof HTMLElement && !control.closest('[hidden], [inert]') &&
    !control.matches(':disabled, input[type=hidden]') && control.getClientRects().length > 0);
  if (!(target instanceof HTMLElement)) return false;
  target.focus();
  target.scrollIntoView({ block: 'center', inline: 'nearest' });
  return document.activeElement === target;
}

export function useFormFeedback({ form, validate, revealField, dependencies = {}, labels = {} }: {
  form: RefObject<HTMLFormElement | null>; validate?: Validator; revealField?: RevealField; dependencies?: Record<string,string[]>; labels?: Record<string,string>;
}) {
  const validateRef=useRef(validate);validateRef.current=validate;
  const prefix = useId();
  const [fieldErrors,setFieldErrors] = useState<FieldErrors>({});
  const [generalError,setGeneralError] = useState('');
  const attempted = useRef(false);
  const summary = useRef<HTMLDivElement>(null);
  const registeredLabels = useRef<Record<string,string>>({});
  const fieldId = (name: string) => `${prefix}-field-${encodeURIComponent(name)}`;
  const errorId = (name: string) => `${fieldId(name)}-error`;
  const focus = async (name: string) => {
    if (!await focusFormField(form.current,name,revealField)) summary.current?.focus();
  };
  const showErrors = (errors: FieldErrors = {}, message = '', moveFocus = true) => {
    attempted.current = true;
    if(moveFocus&&form.current)revealForm(form.current);
    setFieldErrors(errors); setGeneralError(message);
    // Prefer document order, not the order of keys returned by the server.
    const first = Array.from(form.current?.querySelectorAll<HTMLElement>('[name],[data-feedback-fields]') ?? [])
      .filter(element=>!element.matches('input[type=hidden]'))
      .flatMap(element=>(element.dataset.feedbackFields||element.getAttribute('name')||'').split(' '))
      .find(name=>fieldErrorMessages(errors[name]).length) || Object.keys(errors).find(name=>fieldErrorMessages(errors[name]).length);
    if(moveFocus){if (first) void focus(first);else requestAnimationFrame(()=>summary.current?.focus());}
  };
  const reset = () => { attempted.current=false; setFieldErrors({}); setGeneralError(''); };
  const changed = (name: string) => {
    if (!attempted.current || !validateRef.current || !form.current) return;
    const next = validateRef.current(new FormData(form.current));
    setFieldErrors(previous=>[name,...(dependencies[name] || [])].reduce((errors,field)=>updateFieldError(errors,field,next[field]),previous));
  };
  return { fieldErrors, generalError, fieldId, errorId, focus, showErrors, reset, changed, summary,
    label: (name: string) => {
      if(labels[name]||registeredLabels.current[name])return labels[name]||registeredLabels.current[name];
      const element=Array.from(form.current?.querySelectorAll<HTMLElement>('[name],[data-feedback-fields]')||[]).find(el=>!el.matches('input[type=hidden]')&&(el.getAttribute('name')===name||el.dataset.feedbackFields?.split(' ').includes(name)));
      return element?.dataset.feedbackLabel||element?.getAttribute('aria-label')||element?.closest('label')?.textContent?.trim()||name;
    },
    register: (name: string,label: string) => { registeredLabels.current[name]=label; },
  };
}

type Feedback = ReturnType<typeof useFormFeedback>;
const Context = createContext<Feedback | null>(null);
export function FormFeedbackProvider({ feedback,children }: {feedback:Feedback;children:ReactNode}) {
  return <Context.Provider value={feedback}>{children}</Context.Provider>;
}
function useFeedback() {
  const feedback=useContext(Context);
  if (!feedback) throw new Error('FormField necesita FormFeedbackProvider.');
  return feedback;
}
export function FieldError({ name }: {name:string}) {
  const feedback=useFeedback(),messages=fieldErrorMessages(feedback.fieldErrors[name]);
  return messages.length ? <span id={feedback.errorId(name)} className="form-field-error">{messages.map((message,index)=><span className="form-field-error-message" key={index}>{message}</span>)}</span> : null;
}

type ControlProps = { type?:string; id?:string; 'aria-invalid'?:boolean | 'true' | 'false'; 'aria-describedby'?:string };
export function FormField({ name,label,children }: {name:string;label:string;children:ReactElement<ControlProps>}) {
  const feedback=useFeedback();
  feedback.register(name,label);
  const child=Children.toArray(children)[0] as ReactElement<ControlProps>;
  const error=fieldErrorMessages(feedback.fieldErrors[name]).length > 0;
  const describedBy=[child.props['aria-describedby'],error?feedback.errorId(name):''].filter(Boolean).join(' ') || undefined;
  const control=cloneElement(child,{id:feedback.fieldId(name),'aria-invalid':error?true:undefined,'aria-describedby':describedBy});
  return <div className="form-feedback-field">{child.props.type==='checkbox'
    ? <label htmlFor={feedback.fieldId(name)}>{control} {label}</label>
    : <><label htmlFor={feedback.fieldId(name)}>{label}</label>{control}</>}
    <FieldError name={name} />
  </div>;
}
export function FormErrorSummary({purpose='guardar'}:{purpose?:string}={}) {
  const feedback=useFeedback();
  const fields=Object.keys(feedback.fieldErrors).filter(name=>fieldErrorMessages(feedback.fieldErrors[name]).length);
  if (!fields.length && !feedback.generalError) return null;
  return <div className="form-error-summary" role="alert" tabIndex={-1} ref={feedback.summary}>
    {feedback.generalError && <p>{feedback.generalError}</p>}
    {!!fields.length && <><p><strong>Revisá {fields.length} {fields.length===1?'campo':'campos'} para {purpose}.</strong></p>
      <ul>{fields.map(name=><li key={name}><button type="button" onClick={()=>void feedback.focus(name)}>{feedback.label(name)}: {fieldErrorMessages(feedback.fieldErrors[name]).join(' ')}</button></li>)}</ul>
    </>}
  </div>;
}

export function FormFieldGroup({name,label,children}:{name:string;label:string;children:ReactNode}){
 const feedback=useFeedback();feedback.register(name,label);
 const invalid=fieldErrorMessages(feedback.fieldErrors[name]).length>0;
 return <fieldset aria-invalid={invalid||undefined} aria-describedby={invalid?feedback.errorId(name):undefined}><legend>{label}</legend>{children}<FieldError name={name}/></fieldset>;
}

/** Adapter for established long editors: keeps their controlled fields and file inputs mounted. */
export function FormFeedbackBindings({form}:{form:RefObject<HTMLFormElement|null>}){
 const feedback=useFeedback(),[hosts,setHosts]=useState<{name:string;node:HTMLElement}[]>([]);
 useLayoutEffect(()=>{
  const root=form.current;if(!root)return;
  const restore:(()=>void)[]=[],next:{name:string;node:HTMLElement}[]=[],seen=new Set<string>();
  for(const control of root.querySelectorAll<HTMLElement>('input[name],select[name],textarea[name],button[name],[data-feedback-fields]')){
   if(control.closest('.form-feedback-field')||control.matches('input[type=hidden]'))continue;
   const names=(control.dataset.feedbackFields||control.getAttribute('name')||'').split(' ').filter(Boolean);
   const messages=names.filter(name=>fieldErrorMessages(feedback.fieldErrors[name]).length);
   const oldInvalid=control.getAttribute('aria-invalid'),oldDescription=control.getAttribute('aria-describedby');
   if(messages.length){control.setAttribute('aria-invalid','true');control.setAttribute('aria-describedby',[oldDescription,...messages.map(feedback.errorId)].filter(Boolean).join(' '));}
   restore.push(()=>{if(oldInvalid===null)control.removeAttribute('aria-invalid');else control.setAttribute('aria-invalid',oldInvalid);if(oldDescription===null)control.removeAttribute('aria-describedby');else control.setAttribute('aria-describedby',oldDescription);});
   for(const name of names){
    if(seen.has(name))continue;seen.add(name);
    feedback.register(name,control.dataset.feedbackLabel||control.getAttribute('aria-label')||control.closest('label')?.textContent?.trim()||name);
    if(!messages.includes(name))continue;
    const host=document.createElement('span');host.className='form-binding-error';if(control.matches('section,fieldset'))control.appendChild(host);else (control.closest('label')||control).insertAdjacentElement('afterend',host);next.push({name,node:host});restore.push(()=>host.remove());
   }
  }
  setHosts(next);return()=>restore.forEach(fn=>fn());
 },[form,feedback.fieldErrors]);
 return <>{hosts.map(({name,node})=>createPortal(<FieldError name={name}/>,node,name))}</>;
}
