import test from 'node:test';
import assert from 'node:assert/strict';
import {orderShortageOptions} from '../web/order-shortage-options.mjs';

const catalog={name:'科達單方',brand:'科達',category:'單方',code:'A1',drug:'測試品',bottles:1};
const record={id:'SH-12345678-1234-1234-1234-123456789abc',sheet:'科達單方',code:'A1',name:'測試品',revision:1,need:4,threshold:2,priority:'normal',status:'confirmed',supply:'unavailable',eta:'',note:'',actor:'測試員'};
const options=(records,rows)=>orderShortageOptions({records,events:[],orders:[],receipts:[]},rows);

test('active shortages match full supplier item identity, and untracked zero stock stays provisional',()=>{
 const other={...catalog,name:'天明單方',brand:'天明',bottles:0};
 const [tracked,implicit]=options([record],[catalog,other]);
 assert.equal(tracked.shortageStatus,'已確認缺藥・低庫存待補・廠商缺貨');
 assert.equal(implicit.brand,'天明');
 assert.match(implicit.shortageStatus,/待確認開封中存量/);
 assert.equal(options([{...record,name:'過時名稱'}],[{...catalog,bottles:0}]).length,0);
 assert.equal(options([record,record],[catalog]).length,0);
});

test('skips resolved, deferred, sufficient-stock, invalid identity, QA, and unknown stock items',()=>{
 for(const status of ['closed','cancelled'])assert.deepEqual(options([{...record,status}],[catalog]),[]);
 for(const status of ['deferred','sufficient'])assert.deepEqual(options([{...record,status}],[{...catalog,bottles:0}]),[]);
 const bad=[{code:''},{code:'QA20261120A'},{warning:'同分頁編號重複'},{bottles:null}];
 assert.deepEqual(options([],bad.map(patch=>({...catalog,bottles:0,...patch}))),[]);
});
