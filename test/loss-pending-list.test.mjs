import test from 'node:test';
import assert from 'node:assert/strict';
import {lossSlips,lossSheets,showLossSlips} from '../web/loss-pending-list.mjs';
test('legacy uncertainty survives migration; removing one vendor retains other slips',()=>{
 const storage=Object.assign(Object.create({getItem(k){return this[k]??null;},setItem(k,v){this[k]=v;},removeItem(k){delete this[k];}}),{});
 const old={id:'old',verified:false,draft:{date:'2026-11-25',lines:[{sheet:'科達複方'}]}};
 storage.setItem('legacy',JSON.stringify(old));
 const slips=lossSlips(storage,'legacy');
 assert.deepEqual(slips.get('old'),old);
 slips.save({id:'new',phase:'draft',draft:{lines:[{sheet:'天明單方'}],completionSheets:['天明單方','富田複方']}});
 assert.deepEqual(lossSheets(slips.get('new').draft),['天明單方','富田複方']);
 assert.equal(slips.list().length,2);
 slips.remove('new');
 assert.deepEqual(lossSlips(storage,'legacy').list(),[old]);
});
test('preserve unreadable entries and recover previously verified unsent drafts',()=>{
 const storage=Object.assign(Object.create({getItem(k){return this[k]??null;},setItem(k,v){this[k]=v;}}),{legacy:'{','tcm-loss-slip-v1:broken':'{'});
 const slips=lossSlips(storage,'legacy');
 slips.save({id:'valid',phase:'draft',verified:true,draft:{date:'2026-11-25',lines:[]}});
 assert.deepEqual(slips.list().map(r=>[r.id,r.verified]),[['valid',false]]);
 assert.deepEqual([...slips.unreadable],['legacy','tcm-loss-slip-v1:broken']);
 assert.equal(storage['tcm-loss-slip-v1:broken'],'{');
});

test('the list removes just the selected draft, submitted or legacy slip on the first click',t=>{
 const records=['draft','submitted',undefined].map((phase,i)=>({
  id:'test-'+i,phase,draft:{date:'2026-11-26',lines:[{sheet:'測試單方',name:'測試',total:1}]}
 }));
 const articles=records.map((_,i)=>({dataset:{i},classList:{toggle(){}}}));
 const inputs=records.map(()=>({}));
 const controls=new Map();
 const dialog={
  setAttribute(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},
  querySelectorAll(selector){return selector==='article'?articles:inputs;},
  querySelector(selector){if(!controls.has(selector))controls.set(selector,{});return controls.get(selector);}
 };
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>dialog,body:{append(){}}}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 const removed=[],checked=[];
 const open=()=>showLossSlips({records,esc:String,remove:r=>removed.push(r),check:r=>checked.push(r)});
 for(const [index,record] of records.entries()){
  open();
  articles[index].onclick();
  controls.get('[data-delete]').onclick();
  assert.equal(removed.length,index+1);
  assert.equal(removed[index],record);
  assert.equal(dialog.open,false);
 }
 assert.deepEqual(checked,[]);
 open();
 controls.get('[data-check]').onclick();
 assert.equal(dialog.open,true);
 assert.match(controls.get('[role=status]').textContent,/尚未送出/);
 articles[1].onclick();
 controls.get('[data-check]').onclick();
 assert.deepEqual(checked,[records[1]]);
 assert.deepEqual(removed,records);
});
