import test from 'node:test';import assert from 'node:assert/strict';
import {pageScope,protectDraft,allowLeave} from '../web/page-safety.mjs';
import {loadLegacy,empty} from '../web/store.mjs';
test('corrupt legacy JSON and invalid ledgers do not block cloud startup or overwrite original storage',()=>{
 for(const raw of ['{bad',JSON.stringify({version:1,items:[{}],entries:[]})]){let writes=0;const storage={getItem:()=>raw,setItem(){writes++;}};const result=loadLegacy(storage,'legacy');assert.ok(result.error);assert.deepEqual(result.data,empty());assert.equal(writes,0);assert.equal(storage.getItem(),raw);}
 const denied=loadLegacy({getItem(){throw Error('denied');}},'legacy');assert.ok(denied.error);
});
test('late preview from departed page cannot open dialog, including returning to the same route',async()=>{
 const scope=pageScope(),dialogs=[];let release;const response=new Promise(r=>release=r);const ask=scope.wrap(x=>dialogs.push(x));const pending=response.then(()=>ask('old preview'));scope.invalidate();const fresh=scope.wrap(x=>dialogs.push(x));release();await pending;assert.deepEqual(dialogs,[]);fresh('new preview');assert.deepEqual(dialogs,['new preview']);
});
test('draft navigation cancellation keeps mounted page and accepting permits leave',()=>{
 let dirty=true,calls=0;const cleanup=protectDraft(()=>{},()=>dirty);assert.equal(allowLeave(cleanup,()=>{calls++;return false;}),false);assert.equal(allowLeave(cleanup,()=>true),true);dirty=false;assert.equal(allowLeave(cleanup,()=>{throw Error('unexpected prompt');}),true);assert.equal(calls,1);
});
