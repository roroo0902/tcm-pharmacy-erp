import test from 'node:test';
import assert from 'node:assert/strict';
import {staffLoader} from '../web/staff.mjs';
test('staff requests deduplicate concurrent loads, trim names and refresh on next request',async()=>{
 let count=0;const load=staffLoader(async()=>{count++;return {names:[' 甲 ','','甲','乙']};});
 const [a,b]=await Promise.all([load(),load()]);assert.deepEqual(a,['甲','乙']);assert.deepEqual(b,a);assert.equal(count,1);
 await load();assert.equal(count,2);
});
test('failed staff requests can retry and empty roster is not accepted',async()=>{
 let count=0;const load=staffLoader(async()=>{if(++count===1)throw Error('offline');return {names:[]};});
 await assert.rejects(load(),/offline/);await assert.rejects(load(),/尚未填寫/);assert.equal(count,2);
});
