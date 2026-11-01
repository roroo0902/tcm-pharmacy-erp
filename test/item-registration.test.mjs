import test from 'node:test';
import assert from 'node:assert/strict';
import {itemRegistration} from '../web/item-registration.mjs';
import {supplierSelection,parseSupplierCatalog} from '../web/supplier-catalog.mjs';
import {notifySupplierCatalogChanged,watchSupplierCatalog} from '../web/catalog-events.mjs';
test('registration selects dynamic vendor/category and accepts an empty new category with zero opening stock',()=>{
 const sources=[{name:'科達單方',brand:'科達',category:'單方',gid:1},{name:'新廠複方',brand:'新廠',category:'複方',gid:2}];
 const source=supplierSelection(sources,'新廠','複方').source;
 const line=itemRegistration(source,' A1 ',' 測試藥 ','0',[]);assert.deepEqual(line,{sheet:'新廠複方',code:'A1',name:'測試藥',quantity:0});
 const grid=[['','編號','','藥品名稱','價格'],['','','','','','','未拆封']];
 assert.equal(parseSupplierCatalog({sources:[source],sheets:{新廠複方:grid}}).rows.length,0);
});
test('duplicates are scoped to source; blank quantity or missing source cannot become a zero-stock creation',()=>{
 const source={name:'新廠單方'},rows=[{name:'科達單方',code:'A1',drug:'同名'},{name:'新廠單方',code:'A2',drug:'已有'}];
 assert.equal(itemRegistration(source,'A1','同名',2,rows).quantity,2);
 assert.throws(()=>itemRegistration(source,'A2','其他',2,rows),/已有/);assert.throws(()=>itemRegistration(source,'A3','已有',2,rows),/已有/);
 for(const q of ['',-1,1.5,1000001])assert.throws(()=>itemRegistration(source,'A3','新藥',q,rows),/瓶數/);
 assert.throws(()=>itemRegistration(null,'A3','新藥',0,rows),/選擇/);
});
test('catalog notification refreshes current and other open tabs, with no drug data in storage and cleanup on navigation',()=>{
 const target=new EventTarget(),writes=[];let called=0;const stop=watchSupplierCatalog(()=>called++,target);
 notifySupplierCatalogChanged(target,{setItem:(...v)=>writes.push(v)});assert.equal(called,1);assert.equal(writes.length,1);assert.match(writes[0][1],/^\d+-0\./);
 const e=new Event('storage');e.key=writes[0][0];e.newValue=writes[0][1];target.dispatchEvent(e);assert.equal(called,2);
 const other=new Event('storage');other.key='unrelated';other.newValue='1';target.dispatchEvent(other);assert.equal(called,2);
 stop();target.dispatchEvent(e);assert.equal(called,2);
});
test('blocked browser storage does not prevent current-page catalog refresh after cloud creation',()=>{
 const target=new EventTarget();let called=0;const stop=watchSupplierCatalog(()=>called++,target);notifySupplierCatalogChanged(target,{setItem(){throw Error('blocked');}});assert.equal(called,1);stop();
});
