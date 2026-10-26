import test from 'node:test';
import assert from 'node:assert/strict';
import {empty,addItem,addEntry,validate,today} from '../web/store.mjs';
const item={id:'a',name:'測試藥',brand:'測試廠',category:'單方',code:'T1',safety:2,openingDate:today(),openingBottles:10};
const entry=(id,type,bottles)=>({id,itemId:'a',type,bottles,date:today(),actor:'測試員',note:''});
test('備份重載後保留進貨耗損與沖銷計算',()=>{let d=addItem(empty(),item);d=addEntry(d,entry('in','進貨',5));d=addEntry(d,entry('out','耗損',3));assert.equal(validate(JSON.parse(JSON.stringify(d))).balance('a'),12);d=addEntry(d,{...entry('rev','沖銷',3),reverses:'out',note:'誤填'});assert.equal(validate(d).balance('a'),15);assert.equal(d.entries.length,3);});
test('拒絕超量扣庫且不改動原資料',()=>{const d=addItem(empty(),item);assert.throws(()=>addEntry(d,entry('out','耗損',11)),/庫存不足/);assert.equal(d.entries.length,0);});
test('拒絕壞備份、重複ID及未建帳交易',()=>{assert.throws(()=>validate({version:2,items:[],entries:[]}));let d=addItem(empty(),item);d=addEntry(d,entry('in','進貨',5));assert.throws(()=>addEntry(d,entry('in','進貨',5)),/重複/);assert.throws(()=>addEntry(empty(),entry('out','耗損',1)),/尚未建帳/);});
test('拒絕重複沖銷和造成負庫存的進貨沖銷',()=>{let d=addItem(empty(),{...item,openingBottles:0});d=addEntry(d,entry('in','進貨',5));d=addEntry(d,entry('out','耗損',3));assert.throws(()=>addEntry(d,{...entry('rev','沖銷',5),reverses:'in',note:'更正'}),/庫存不足/);d=addEntry(d,{...entry('rev','沖銷',3),reverses:'out',note:'更正'});assert.throws(()=>addEntry(d,{...entry('rev2','沖銷',3),reverses:'out',note:'更正'}),/已沖銷/);});
