import test from 'node:test';
import assert from 'node:assert/strict';
import {queueShortage,seedShortage,shortageLinks,clearShortage} from '../web/shortage-handoff.mjs';
import {receiptKey} from '../web/receive-grid-data.mjs';
import {historyEntries,renderHistory} from '../web/history-display.mjs';

const qa={id:'SH-12345678-1234-1234-1234-123456789abc',sheet:'科達單方',code:'QA20261120A',name:'甲',quantity:4};
const other={...qa,id:'SH-22345678-1234-1234-1234-123456789abc',sheet:'天明單方',name:'乙',quantity:2};
const catalog=r=>({name:r.sheet,code:r.code,drug:r.name});
function memory(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('operational shortage handoff excludes exact QA in new queue, stale input and persisted links only for order',t=>{
 for(const k of ['localStorage','sessionStorage']){
  const property=Object.getOwnPropertyDescriptor(globalThis,k);
  Object.defineProperty(globalThis,k,{value:memory(),configurable:true});
  t.after(()=>property?Object.defineProperty(globalThis,k,property):delete globalThis[k]);
 }
 const key='tcm-shortage-handoff-v1';
 queueShortage('order',[qa]);assert.equal(sessionStorage.getItem(key),null);
 sessionStorage.setItem(key,JSON.stringify({action:'order',records:[qa]}));
 let q=new Map();
 assert.deepEqual(seedShortage('order',[],q,receiptKey).records,[]);
 assert.deepEqual(shortageLinks('order',[qa]),[]);
 queueShortage('order',[qa,other]);
 q=new Map();
 assert.deepEqual(seedShortage('order',[catalog(other)],q,receiptKey).records,[other]);
 assert.equal(q.size,1);
 assert.deepEqual(shortageLinks('order',[qa,other]),[{shortageId:other.id,sheet:other.sheet,code:other.code,quantity:2}]);
 clearShortage('order');queueShortage('receive',[qa]);q=new Map();
 assert.deepEqual(seedShortage('receive',[catalog(qa)],q,receiptKey).records,[qa]);
 assert.equal(q.size,0);
 assert.deepEqual(shortageLinks('receive',[{...qa,quantity:1}]),[{shortageId:qa.id,sheet:qa.sheet,code:qa.code,quantity:1}]);
});
test('general history marks exact QA code plus supplier and inherits reversal mark without removing audit',()=>{
 const row=(id,action,line,reverses)=>[id,JSON.stringify({draft:{action,lines:[line],...(reverses?{reverses}:{})}}),'2026-11-20','','營運','','','讀回','08:00'];
 const rows=[row('ERP-exact','訂貨',qa),row('ERP-real','訂貨',other),row('ERP-reversed','取消訂貨',other,'ERP-exact')];
 const entries=historyEntries([{s:{title:'訂貨',id:'fixture',gid:1},rows}]);
 const map=new Map(entries.map(e=>[e.id,e.marked]));
 assert.deepEqual([map.get('ERP-exact'),map.get('ERP-real'),map.get('ERP-reversed')],[true,false,true]);
 assert.match(renderHistory(entries),/測試紀錄/);
 assert.match(renderHistory(entries),/ERP-exact/);
 assert.match(renderHistory(entries),/ERP-reversed/);
});
