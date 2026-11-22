import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptEntryDialog} from '../web/receipt-entry-dialog.mjs';
test('entry reminder escapes all pending values and only dispatches the chosen action',()=>{
 const original=globalThis.document;let current;const calls={check:0,cancel:0};
 globalThis.document={createElement(){const buttons={};current={setAttribute(){},querySelector(s){return buttons[s]??={};},addEventListener(t,f){this[t+'Event']=f;},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;}};return current;},body:{append(){}}};
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const d={date:'2026-11-20',actor:'<actor>',lines:[{name:'<script>bad</script>',code:'<code>',sheet:'<sheet>',quantity:2}]};
 const open=()=>receiptEntryDialog(d,{esc,onCheck:()=>calls.check++,onCancel:()=>calls.cancel++});
 try{
 open();assert.match(current.innerHTML,/2026\/11\/20/);assert.match(current.innerHTML,/1 項・2 瓶/);assert.match(current.innerHTML,/&lt;script&gt;bad&lt;\/script&gt;/);assert.doesNotMatch(current.innerHTML,/<script>/);assert.deepEqual(calls,{check:0,cancel:0});
 current.querySelector('[data-choice="later"]').onclick();assert.equal(current.removed,true);assert.deepEqual(calls,{check:0,cancel:0});
 open();current.querySelector('[data-choice="check"]').onclick();assert.equal(current.removed,true);assert.deepEqual(calls,{check:1,cancel:0});
 open();current.querySelector('[data-choice="cancel"]').onclick();assert.equal(current.removed,true);assert.deepEqual(calls,{check:1,cancel:1});
 open();let prevented=false;current.cancelEvent({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(current.removed,true);assert.deepEqual(calls,{check:1,cancel:1});
 }finally{globalThis.document=original;}
});
