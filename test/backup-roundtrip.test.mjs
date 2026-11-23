import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {empty,validate,addItem,addEntry,today} from '../web/store.mjs';
import {validateOrderStore} from '../src/orders.mjs';
const legacyKey='tcm-pharmacy-local-v1',orderKey='tcm-purchase-v2';
const legacy=addEntry(addItem(empty(),{id:'QA',name:'非藥品',brand:'QA',category:'單方',code:'QA',safety:0,openingDate:today(),openingBottles:2}),{id:'QA-in',itemId:'QA',type:'進貨',bottles:1,date:today(),actor:'QA',note:'isolated'});
const options={start:'2026-11-16',end:'2026-11-17',ignore:[],targetDays:7,shippingDays:0.5,holidayDays:0,blankAsZero:true};
const row={id:'QA',sheet:'科達單方',brand:'科達',category:'單方',code:'QA',name:'非藥品',stockDate:'2026-11-17',status:'',shortage:'',warnings:[],usage:1,stock:3,average:0.5,suggested:1,quantity:2};
const orders={drafts:{科達單方:{snapshot:{options,rows:[row]},quantities:{QA:'2'},legacy:[],lastSync:'QA'}},orders:[{kind:'tcm-purchase-order',version:2,id:'QA-order',actor:'QA',status:'已確認草稿・未送出',options,lines:[row]}]};
function fixture(kind,storage=new Map()){
 const key=kind==='legacy'?legacyKey:orderKey,elements=new Map(),downloads=[];let pending=null,rendered,notice='';
 const el=s=>{if(!elements.has(s))elements.set(s,{});return elements.get(s)};
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 const c=vm.createContext({console,Blob,JSON,Date,validate,validateOrderStore,empty,today,localStorage,KEY:key,c:{},r:'backup',locked:false,data:kind==='legacy'?JSON.parse(storage.get(key)||JSON.stringify(empty())):null,
  $:el,document:{createElement:()=>({click(){downloads.push({name:this.download,blob:blobs.get(this.href)})}})},URL:{createObjectURL:b=>{const u='blob:'+blobs.size;blobs.set(u,b);return u},revokeObjectURL(){}},setTimeout:fn=>fn(),
  ask:(_html,action)=>{pending=action},message:t=>notice=t,status:t=>notice=t,
  navigator:{locks:{request:async(_key,action)=>action()}},render(){rendered=JSON.parse(localStorage.getItem(key))},read(){},source:{name:'科達單方'},select(){rendered=validateOrderStore(JSON.parse(localStorage.getItem(key)))}});
 const blobs=new Map();
 if(kind==='legacy'){
  const src=fs.readFileSync('web/app.mjs','utf8');const mutation=src.split(/\r?\n/).find(x=>x.startsWith('async function mutate('));const block=src.split(/\r?\n/).find(x=>x.includes("if(r==='backup')"));vm.runInContext(mutation+'\n'+block,c);
 }else{
  const src=fs.readFileSync('web/orders.mjs','utf8').split(/\r?\n/);vm.runInContext(src.filter(x=>x.includes('const stored=')||x.includes('const download=')||x.includes("$('#order-backup').onclick=")||x.includes("$('#order-restore').onchange=")).join('\n'),c);
 }
 async function choose(file){const input=el(kind==='legacy'?'#restore':'#order-restore'),path='C:/fakepath/'+file.name;if(input.value===path)return false;if(!Object.hasOwn(input,'value')){let selected='';Object.defineProperty(input,'value',{get:()=>selected,set:v=>{selected=v;if(v==='')input.files=[];}});}input.value=path;input.files=[file];pending=null;await input.onchange({target:input});return true;}
 return {choose,storage,downloads,key,export:()=>el(kind==='legacy'?'#export':'#order-backup').onclick(),async restore(raw){pending=null;await el(kind==='legacy'?'#restore':'#order-restore').onchange({target:{files:[{size:raw.length,text:async()=>raw}]}})},cancel(){pending=null},async confirm(){assert.equal(typeof pending,'function');await pending();pending=null},get pending(){return pending},get notice(){return notice},reopen(){return kind==='legacy'?validate(JSON.parse(storage.get(key))):validateOrderStore(JSON.parse(storage.get(key)))},get rendered(){return rendered}};
}
for(const kind of ['legacy','orders']){
 const key=kind==='legacy'?legacyKey:orderKey,initial=kind==='legacy'?legacy:orders;
 test(`${kind}: real export handler produces readable JSON with all local records`,async()=>{const h=fixture(kind,new Map([[key,JSON.stringify(initial)]]));h.export();assert.equal(h.downloads.length,1);const saved=JSON.parse(await h.downloads[0].blob.text());assert.deepEqual(kind==='legacy'?saved:{drafts:saved.drafts,orders:saved.orders},initial);if(kind==='orders'){assert.equal(saved.kind,'tcm-purchase-backup');assert.equal(saved.version,2);}});
 test(`${kind}: cancel leaves post-export changes intact; confirm restores and fresh reopen reads`,async()=>{const h=fixture(kind,new Map([[key,JSON.stringify(initial)]]));h.export();const raw=await h.downloads[0].blob.text();const changed=structuredClone(initial);if(kind==='legacy')changed.items[0].openingBottles=9;else changed.drafts.科達單方.quantities.QA='9';h.storage.set(key,JSON.stringify(changed));await h.restore(raw);assert.equal(typeof h.pending,'function');h.cancel();assert.deepEqual(JSON.parse(h.storage.get(key)),changed);await h.restore(raw);await h.confirm();assert.deepEqual(JSON.parse(h.storage.get(key)),initial);const reopened=fixture(kind,h.storage);if(kind==='legacy')assert.equal(reopened.reopen().balance('QA'),3);else assert.equal(reopened.reopen().drafts.科達單方.quantities.QA,'2');});
 test(`${kind}: cross-import rejects without prompt or changes`,async()=>{const h=fixture(kind,new Map([[key,JSON.stringify(initial)]])),other=kind==='legacy'?{kind:'tcm-purchase-backup',version:2,...orders}:legacy,before=h.storage.get(key);await h.restore(JSON.stringify(other));assert.equal(h.pending,null);assert.equal(h.storage.get(key),before);assert.match(h.notice,/格式/);});
 test(`${kind}: corrupt JSON rejects without changes`,async()=>{const h=fixture(kind,new Map([[key,JSON.stringify(initial)]])),before=h.storage.get(key);await h.restore('{broken');assert.equal(h.pending,null);assert.equal(h.storage.get(key),before);});
}

test('legacy: the same file can be reselected after invalid JSON or cancellation without changing data',async()=>{
 const h=fixture('legacy',new Map([[legacyKey,JSON.stringify(legacy)]])),before=h.storage.get(legacyKey);
 let reads=0;const bad={name:'backup.json',size:7,text:async()=>{reads++;return '{broken';}};
 assert.equal(await h.choose(bad),true);assert.equal(await h.choose(bad),true);assert.equal(reads,2);
 assert.equal(h.pending,null);assert.equal(h.storage.get(legacyKey),before);
 const changed=structuredClone(legacy);changed.items[0].openingBottles=9;const raw=JSON.stringify(changed);
 const good={name:'backup.json',size:raw.length,text:async()=>raw};
 assert.equal(await h.choose(good),true);assert.equal(typeof h.pending,'function');h.cancel();
 assert.equal(h.storage.get(legacyKey),before);
 assert.equal(await h.choose(good),true);assert.equal(typeof h.pending,'function');await h.confirm();
 assert.deepEqual(JSON.parse(h.storage.get(legacyKey)),changed);
});

test('orders: same-file picker retries after invalid JSON without touching saved orders',async()=>{
 const h=fixture('orders',new Map([[orderKey,JSON.stringify(orders)]])),before=h.storage.get(orderKey);let reads=0;
 const bad={name:'orders.json',size:7,text:async()=>{reads++;return '{broken';}};
 assert.equal(await h.choose(bad),true);assert.equal(await h.choose(bad),true);assert.equal(reads,2);
 assert.equal(h.pending,null);assert.equal(h.storage.get(orderKey),before);
});

test('orders: cancelling valid restore allows same-file reselect and explicit confirmation',async()=>{
 const h=fixture('orders',new Map([[orderKey,JSON.stringify(orders)]])),before=h.storage.get(orderKey);
 const changed=structuredClone(orders);changed.drafts.科達單方.quantities.QA='9';
 const raw=JSON.stringify({kind:'tcm-purchase-backup',version:2,...changed}),good={name:'orders.json',size:raw.length,text:async()=>raw};
 assert.equal(await h.choose(good),true);assert.equal(typeof h.pending,'function');h.cancel();
 assert.equal(h.storage.get(orderKey),before);
 assert.equal(await h.choose(good),true);assert.equal(typeof h.pending,'function');assert.equal(h.storage.get(orderKey),before);
 await h.confirm();assert.equal(h.reopen().drafts.科達單方.quantities.QA,'9');
});
