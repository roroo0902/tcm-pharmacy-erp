import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseOrderFollowup} from '../web/order-followup.mjs';
test('pending order cannot offer current-only; verified order still can',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');
 let selected='previous';const nodes=new Map(),node=k=>{if(!nodes.has(k))nodes.set(k,{});return nodes.get(k);};
 const dialog={setAttribute(){},close(){},remove(){},addEventListener(){},showModal(){},querySelector:k=>k==='[name=followup-mode]:checked'?{value:selected}:node(k),querySelectorAll:()=>[...dialog.innerHTML.matchAll(/name="followup-mode" value="([^"]+)"/g)].map(m=>node(m[1]))};
 Object.defineProperty(globalThis,'document',{configurable:true,writable:true,value:{createElement:()=>dialog,body:{append(){}}}});
 const data={date:'2026-11-20',actor:'QA',count:0,lines:[]};
 const pick=k=>{assert.match(dialog.innerHTML,new RegExp('name="followup-mode" value="'+k+'"'));selected=k;node(k).onchange();node('[data-next]').onclick();};
 try{
  let ans=chooseOrderFollowup({...data,pending:true},data);
  assert.doesNotMatch(dialog.innerHTML,/value="current"|只完成本筆訂貨單/);assert.match(dialog.innerHTML,/不能單獨預覽本筆.*本筆輸入會保留/);
  pick('merge');assert.equal(node('[data-merge]').hidden,false);assert.equal(await ans,'merge');
  ans=chooseOrderFollowup({...data,pending:true},data);pick('previous');assert.equal(await ans,'previous');
  ans=chooseOrderFollowup({...data,pending:true},data);node('[data-back]').onclick();assert.equal(await ans,null);
  ans=chooseOrderFollowup({...data,pending:false},data);pick('current');assert.equal(await ans,'current');
 }finally{if(old)Object.defineProperty(globalThis,'document',old);else delete globalThis.document;}
});
