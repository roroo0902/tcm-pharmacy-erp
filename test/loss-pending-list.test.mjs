import test from 'node:test';
import assert from 'node:assert/strict';
import {lossSlips,lossSheets} from '../web/loss-pending-list.mjs';
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
