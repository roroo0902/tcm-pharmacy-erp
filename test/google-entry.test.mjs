import test from 'node:test';
import assert from 'node:assert/strict';
import {ENTRY_KEY,entryPreference,autoOpenGoogle,googleEntryUrl,restoreGooglePage} from '../web/google-entry.mjs';
test('remembered entry survives reload, can be cancelled, and does not hold credentials',()=>{
 const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
 assert.equal(autoOpenGoogle(storage,'','#receive'),false);
 assert.equal(entryPreference(storage,true),true);
 assert.deepEqual([...values],[[ENTRY_KEY,'google']]);
 assert.equal(autoOpenGoogle(storage,'','#loss'),true);
 assert.equal(autoOpenGoogle(storage,'?stay=1','#loss'),false);
 assert.equal(autoOpenGoogle(storage,'','#backup'),false);
 entryPreference(storage,false);assert.equal(autoOpenGoogle(storage,'','#loss'),false);
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.equal(entryPreference(blocked,true),false);
 assert.equal(autoOpenGoogle(blocked,'','#receive'),false);
});
test('hosted entry preserves the chosen page and rejects arbitrary redirect targets',async()=>{
 const url=new URL(googleEntryUrl('#receive'));
 assert.equal(url.origin,'https://script.google.com');assert.equal(url.searchParams.get('page'),'receive');
 assert.equal(new URL(googleEntryUrl('https://example.com')).searchParams.get('page'),'overview');
 const location={hash:''};const google={script:{run:{},url:{getLocation:fn=>fn({parameter:{page:'loss'}})}}};
 await restoreGooglePage(google,location);assert.equal(location.hash,'loss');
 google.script.url.getLocation=fn=>fn({parameter:{page:'https://example.com'}});
 await restoreGooglePage(google,location);assert.equal(location.hash,'overview');
 const local={hash:'#history'};await restoreGooglePage(undefined,local);assert.equal(local.hash,'#history');
});

test('remembered GitHub visit opens its selected Google page immediately and keeps the stay override',async()=>{
 const {openRememberedEntry}=await import('../web/google-entry.mjs');
 const keys=['location','localStorage','google'];
 const saved=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 const opened=[];
 const location={search:'',hash:'#items',replace:url=>opened.push(url)};
 try{
  for(const [k,v] of Object.entries({location,localStorage:{getItem:()=> 'google'},google:undefined}))
   Object.defineProperty(globalThis,k,{value:v,configurable:true});
  assert.equal(openRememberedEntry(),true);
  assert.deepEqual(opened,[googleEntryUrl('#items')]);
  location.search='?stay=1';assert.equal(openRememberedEntry(),false);
  location.search='';location.hash='#backup';assert.equal(openRememberedEntry(),false);
  location.hash='#items';Object.defineProperty(globalThis,'google',{value:{script:{run:{}}}});
  assert.equal(openRememberedEntry(),false);
  assert.equal(opened.length,1);
 }finally{keys.forEach((k,i)=>saved[i]?Object.defineProperty(globalThis,k,saved[i]):Reflect.deleteProperty(globalThis,k));}
});

test('authenticated order output keeps the confirmed ID, action and merge choice through the Google entry',async()=>{
 const {orderEntryUrl}=await import('../web/google-entry.mjs');
 const id='ERP-01234567-aaaa',prior='ERP-87654321-bbbb';
 for(const output of ['mail','print','pdf']){
  for(const mergeIds of [null,[],[prior]]){
   const url=new URL(orderEntryUrl(id,output,mergeIds));
   assert.equal(url.origin,'https://script.google.com');
   const google={script:{run:{},url:{getLocation:fn=>fn({parameter:Object.fromEntries(url.searchParams)})}}};
   const loc={hash:''};
   assert.deepEqual(await restoreGooglePage(google,loc),{id,output,mergeIds});
   assert.equal(loc.hash,'history');
  }
 }
});
test('a malformed or non-review handoff cannot start an order action',async()=>{
 const {orderEntryRequest}=await import('../web/google-entry.mjs');
 const valid={page:'history',orderId:'ERP-01234567',output:'mail'};
 for(const bad of [{page:'loss'},{orderId:''},{output:'send'},{previous:'ERP-01234567'},{previous:'bad'}]){
  assert.equal(orderEntryRequest({...valid,...bad}),null);
 }
});
