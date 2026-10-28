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
