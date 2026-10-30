import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findPostedTransaction} from '../src/pending-transaction.mjs';
const row=(id,action,reverses,status='已取消・未發送')=>[id,JSON.stringify({draft:{id,action,reverses}}),'',action,'','','',status];
test('an interrupted cancellation resolves to the recorded cancellation of the same order',()=>{
 const saved=row('saved','取消訂貨','order1');
 assert.equal(findPostedTransaction([saved],{id:'interrupted',action:'取消訂貨',reverses:'order1'}),saved);
});
test('never reconciles a different order, an unconfirmed cancellation, or a normal order',()=>{
 const saved=row('saved','取消訂貨','order1');
 assert.equal(findPostedTransaction([saved],{id:'x',action:'取消訂貨',reverses:'order2'}),null);
 assert.equal(findPostedTransaction([row('saved','取消訂貨','order1','待發送・未入庫')],{id:'x',action:'取消訂貨',reverses:'order1'}),null);
 assert.equal(findPostedTransaction([saved],{id:'x',action:'訂貨',reverses:'order1'}),null);
});
test('exact transaction ID takes priority and malformed records are ignored',()=>{
 const exact=row('same','訂貨');
 assert.equal(findPostedTransaction([row('other','取消訂貨','order1'),exact],{id:'same',action:'取消訂貨',reverses:'order1'}),exact);
 assert.equal(findPostedTransaction([['broken','bad json','','取消訂貨','','','','已取消・未發送']],{id:'x',action:'取消訂貨',reverses:'order1'}),null);
});
