import test from 'node:test';import assert from 'node:assert/strict';
import {chooseNavigationAnchor,navigationRestorationDecision} from '../../lib/navigation-context.ts';
import {id,frame} from './fixtures.mjs';
test('preserves surviving row; prefers next, then previous, then clamped index; handles empty lists',()=>{
 const f=frame(2);assert.equal(chooseNavigationAnchor(f,[f.anchor,...f.neighbors]),f.anchor);
 assert.equal(chooseNavigationAnchor(f,f.neighbors),f.neighbors[0]);assert.equal(chooseNavigationAnchor(f,[f.neighbors[1]]),f.neighbors[1]);
 assert.equal(chooseNavigationAnchor({...f,index:Number.MAX_SAFE_INTEGER},['a','b']),'b');assert.equal(chooseNavigationAnchor(f,[]),null);
});
test('only matching, unexpired requests restore; origin waits and new destinations discard',()=>{
 const f=frame(),request={frame:f,origin:`/coordinacion/registro/${id(1)}`,expires:100};
 assert.equal(navigationRestorationDecision(request,f.destination,{now:99}),'restore');
 assert.equal(navigationRestorationDecision(request,request.origin,{now:99}),'wait');
 assert.equal(navigationRestorationDecision(request,'/coordinacion/informes',{now:99}),'discard');
 assert.equal(navigationRestorationDecision(request,f.destination,{now:100}),'discard');
 assert.equal(navigationRestorationDecision(null,f.destination,{now:1}),'discard');
});
test('an open modal postpones restoration, while a field error cancels it',()=>{
 const f=frame(),request={frame:f,origin:null,expires:100};
 assert.equal(navigationRestorationDecision(request,f.destination,{now:1,dialog:true}),'wait');
 assert.equal(navigationRestorationDecision(request,f.destination,{now:1,errorFocus:true}),'discard');
});
test('expected logistics disclosure permits row restoration; action modals and errors retain priority',()=>{
 const f=frame(1,{destination:`/coordinacion/salidas/${id(1)}?pestana=logistica&desglose=transporte`,anchor:`transporte-${id(2)}`,list:'transport',neighbors:[`transporte-${id(3)}`]});
 const request={frame:f,origin:null,expires:100};
 assert.equal(navigationRestorationDecision(request,f.destination,{now:1,dialog:true,restorableDialog:true}),'restore');
 assert.equal(navigationRestorationDecision(request,f.destination,{now:1,dialog:true,restorableDialog:false}),'wait');
 assert.equal(navigationRestorationDecision(request,f.destination,{now:1,dialog:true,restorableDialog:true,errorFocus:true}),'discard');
 assert.equal(chooseNavigationAnchor(f,[`transporte-${id(3)}`]),`transporte-${id(3)}`);
 assert.equal(chooseNavigationAnchor(f,[]),null);
});
