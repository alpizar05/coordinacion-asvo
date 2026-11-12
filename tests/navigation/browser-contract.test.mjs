import test from 'node:test';import assert from 'node:assert/strict';
import {createNavigationBrowserSuite} from './browser.mjs';
test('browser suite refuses remote/beta targets before navigating',async()=>{
 let touched=false;const tab={url:async()=>'https://coordinacion-asvo.vercel.app',goto:async()=>{touched=true;}};
 await assert.rejects(createNavigationBrowserSuite({tab,fixture:{}}).basics(),/nonlocal/);assert.equal(touched,false);
});
test('browser suite refuses a local app without the server demo marker',async()=>{
 const tab={url:async()=>'http://localhost:3031',goto:async()=>{},playwright:{getByRole:()=>({first(){return this;},waitFor:async()=>{}}),locator:()=>({count:async()=>0})}};
 await assert.rejects(createNavigationBrowserSuite({tab,fixture:{}}).basics(),/not in demo mode/);
});
