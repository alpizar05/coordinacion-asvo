// DOM-adapter tests of the real restoration function, separate from the pure unit suite.
import test from 'node:test';import assert from 'node:assert/strict';
import {restoreNavigationPosition} from '../../app/coordinacion/navigation-position.ts';
class Node {
 constructor(id,{visible=true,disabled=false,inert=false}={}){this.id=id;this.visible=visible;this.disabled=disabled;this.inert=inert;this.children=[];this.dataset={};this.focuses=0;}
 getClientRects(){return this.visible?[{}]:[];}
 getBoundingClientRect(){return {top:100,bottom:140};}
 contains(node){return this.children.includes(node);}
 matches(){return this.disabled;}
 closest(selector){return selector==='[inert]'&&this.inert?this:null;}
 querySelector(){return this.children[0]??null;}
 querySelectorAll(){return this.children;}
 focus(){this.focuses++;globalThis.document.activeElement=this;}
}
function scenario(options={}){
 const keys=['document','window','HTMLElement','scrollY'];const originals=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 const link=new Node('person'),trigger=new Node('manage',options),nextLink=new Node('next-person'),row=new Node('inscripcion-1'),nextRow=new Node('inscripcion-2'),list=new Node('requests'),body=new Node('body');
 row.children=[link,trigger];nextRow.children=[nextLink];list.children=options.deleted?[nextRow]:[row,nextRow];
 const scroll=[];const dom={activeElement:options.outside?body:trigger,querySelector:()=>list,querySelectorAll:()=>[],getElementById:id=>list.children.find(n=>n.id===id)??null};
 for(const[key,value]of Object.entries({document:dom,window:{scrollTo:value=>scroll.push(value)},HTMLElement:Node,scrollY:100}))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 try{restoreNavigationPosition({destination:'/coordinacion/convocatorias',anchor:'inscripcion-1',offset:70,y:100,list:'requests',index:0,neighbors:['inscripcion-2']},options.focus??true);return {active:dom.activeElement.id,linkCalls:link.focuses,nextCalls:nextLink.focuses,scroll};}
 finally{keys.forEach((k,i)=>{if(originals[i])Object.defineProperty(globalThis,k,originals[i]);else delete globalThis[k];});}
}
test('keeps the modal-restored trigger while still restoring scroll',()=>{const r=scenario();assert.equal(r.active,'manage');assert.equal(r.linkCalls,0);assert.equal(r.scroll[0].top,130);});
test('focus outside the origin row falls back to its first link',()=>assert.equal(scenario({outside:true}).active,'person'));
test('a deleted origin still falls back to the next available row',()=>assert.equal(scenario({deleted:true,outside:true}).active,'next-person'));
test('a hidden trigger is not retained',()=>assert.equal(scenario({visible:false}).active,'person'));
test('a disabled trigger is not retained',()=>assert.equal(scenario({disabled:true}).active,'person'));
test('an inert trigger is not retained',()=>assert.equal(scenario({inert:true}).active,'person'));
test('scroll-only restoration never changes focus',()=>{const r=scenario({outside:true,focus:false});assert.equal(r.active,'body');assert.equal(r.linkCalls,0);assert.equal(r.scroll[0].top,130);});
