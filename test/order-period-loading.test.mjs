import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPeriodControls} from '../web/period-controls.mjs';

test('order entry opens with background statistics and ignores superseded periods',async t=>{
 const requests=[];
 t.after(()=>{delete globalThis.google;});
 globalThis.google={script:{run:{withSuccessHandler(resolve){
  return {withFailureHandler(reject){
   return {erpHosted(method,input){requests.push({method,input,resolve,reject});}};
  }};
 }}}};
 const elements=new Map();
 function element(name){
  if(!elements.has(name))elements.set(name,{value:'',checked:false,disabled:false,dataset:{},setAttribute(){}});
  return elements.get(name);
 }
 const root={querySelector:element,querySelectorAll:()=>[]};
 element('#period-days').value='3';
 const received=[],availability=[];
 const ui=mountPeriodControls(root,{onData:value=>received.push(value),onAvailability:value=>availability.push(value)});
 assert.equal(element('#period-apply').textContent,'背景讀取中…');
 assert.equal(availability.at(-1),false);
 element('#period-start').oninput();
 element('#period-apply').onclick();
 assert.equal(requests.length,2);
 requests[0].resolve({period:{days:3}});
 await new Promise(setImmediate);
 assert.equal(received.length,0);
 assert.equal(availability.at(-1),false);
 requests[1].resolve({period:{days:3,includeToday:false},readAt:Date.now(),rows:[]});
 await new Promise(setImmediate);
 assert.equal(received.length,1);
 assert.equal(availability.at(-1),true);
 element('#period-start').oninput();
 assert.equal(availability.at(-1),false);
 ui.dispose();
});
