import {test} from 'node:test';import assert from 'node:assert/strict';
import {RememberRegistrationForm} from '../../app/remember-registration.tsx';
import {begin,flush,reset} from './stubs.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const child of [tree.props?.children].flat(Infinity)){const result=find(child,predicate);if(result)return result;}return null;}
function text(tree){if(tree==null)return '';if(typeof tree!=='object')return String(tree);return [tree.props?.children].flat(Infinity).map(text).join('');}
class Input {name='identification';value='';selectionStart=0;setSelectionRange(){} }
test('real public form: nine digits, stale responses, not found, failure and paste keep data/focus',async()=>{
 globalThis.HTMLInputElement=Input;globalThis.HTMLTextAreaElement=class{};globalThis.localStorage={getItem(){return null;}};
 const requests=[],props={outingId:'fictitious',schedule:{flexible:false,starts:'2035-01-10',ends:'2035-01-12'},children:null,action:async()=>{throw Error('No submission expected');},lookupIdentity:id=>new Promise((resolve,reject)=>requests.push({id,resolve,reject}))};
 const render=()=>{begin();const tree=RememberRegistrationForm(props);flush();return tree;};
 let tree=render();const input=new Input();const enter=value=>{input.value=value;input.selectionStart=value.length;find(tree,n=>n.type==='form').props.onInput({target:input});tree=render();};
 const status=()=>find(tree,n=>n.props?.role==='status'&&n.props?.['aria-live']==='polite');
 enter('80000070');await pause(280);assert.equal(requests.length,0);
 enter('800000701');tree=render();assert.match(text(status()),/Buscando/);await pause(280);assert.equal(requests[0].id,'800000701');
 enter('800000702');await pause(280);requests[0].resolve({kind:'found',name:'Nombre viejo'});await pause(0);tree=render();assert.doesNotMatch(text(status()),/Nombre viejo/);
 requests[1].resolve({kind:'not-found'});await pause(0);tree=render();assert.match(text(status()),/No encontramos/);assert.equal(find(tree,n=>n.props?.name==='identification'&&n.props?.label).props.invalid,true);
 enter('800000701');await pause(280);requests[2].resolve({kind:'found',name:'Persona Ficticia Local'});await pause(0);tree=render();assert.match(text(status()),/Persona Ficticia Local/);
 enter('80000070');assert.doesNotMatch(text(status()),/Persona Ficticia/);
 enter('800000703');await pause(280);requests[3].reject(Error('simulated'));await pause(0);tree=render();assert.match(text(status()),/No pudimos/);assert.equal(input.value,'800000703');
 let prevented=false;input.value='';input.selectionStart=0;input.selectionEnd=0;input.dispatchEvent=()=>find(tree,n=>n.type==='form').props.onInput({target:input});
 find(tree,n=>n.type==='form').props.onPaste({target:input,preventDefault(){prevented=true;},clipboardData:{getData:()=> '8-0000 0701'}});assert.equal(prevented,true);assert.equal(input.value,'800000701');tree=render();
 const control=find(tree,n=>n.type==='input'&&n.props.name==='identification');assert.equal(control.props.inputMode,'numeric');assert.equal(control.props.maxLength,9);assert.ok(control.props['aria-describedby'].includes(status().props.id));
 reset();delete globalThis.localStorage;delete globalThis.HTMLInputElement;delete globalThis.HTMLTextAreaElement;
});
