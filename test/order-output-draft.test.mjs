import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {prepareOrderOutputDraft} from '../web/order-output-draft.mjs';

const gas=vm.createContext({});
vm.runInContext(readFileSync('gas/cloud/OrderDelivery.gs','utf8'),gas);
const plans=[{brand:'科達',date:'2026-11-26',items:[{sheet:'科達單方',code:'A147',name:'測試',quantity:2}]}];
const source=gas.orderPdfSeed_(plans);
const picked={brand:'科達',category:'單方',code:'A147',name:'測試',quantity:'1',catalog:true,shortage:true};
const typed={brand:'科達',category:'複方',name:'手寫方',quantity:'2',manual:true,shortage:true};
const snapshot=(...additions)=>({sourceHash:'synthetic',mergeIds:[],rows:[...source.rows,...additions]});

test('shortage additions merge by supplier, category and code and survive GAS preview and PDF',()=>{
 const draft=snapshot(picked,{...picked,shortage:false},{...picked,brand:'富田'},{...picked,category:'複方',name:'另一品'},typed);
 const before=JSON.stringify(draft);
 const payload=prepareOrderOutputDraft(draft,source);
 const groups=gas.reviseOrderPdf_(plans,payload);
 assert.deepEqual(Array.from(groups,g=>[g.brand,Array.from(g.items,r=>r.quantity)]),[['科達',[4,1,2]],['富田',[1]]]);
 assert.match(gas.orderPdfHtml_(groups[0]),/手寫方（手動登錄缺藥）/);
 assert.match(gas.orderPdfHtml_(groups[1]),/測試（A147）/);
 assert.deepEqual(prepareOrderOutputDraft(draft,source),payload);
 assert.equal(JSON.stringify(draft),before);
});

test('blank entries stay out of PDF; partial and ambiguous entries require correction',()=>{
 const empty=snapshot({...typed,quantity:'',name:''},{...picked,code:'',name:'',quantity:''});
 assert.equal(prepareOrderOutputDraft(empty,source).rows.length,1);
 for(const row of [{...picked,code:'',search:'A'}, {...typed,quantity:0}, {...typed,quantity:1.5}, {...picked,quantity:1000000}]){
  assert.throws(()=>prepareOrderOutputDraft(snapshot(row),source));
 }
 assert.throws(()=>prepareOrderOutputDraft(snapshot({...typed,category:'單方',name:'測 試'}),source),/同名品項/);
 assert.throws(()=>prepareOrderOutputDraft(snapshot(typed,typed),source),/同名品項/);
});

test('picking a removed source row adds only the requested bottles',()=>{
 const payload=prepareOrderOutputDraft({rows:[picked]},source);
 assert.equal(gas.reviseOrderPdf_(plans,payload)[0].items[0].quantity,1);
 assert.equal(source.rows[0].quantity,2);
});
