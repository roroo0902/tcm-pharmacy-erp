import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {customSupplier,itemRegistration} from '../web/item-registration.mjs';
test('custom supplier trims names, reuses existing category and rejects unsafe or empty names',()=>{
 const existing={name:'新廠單方',brand:'新廠',category:'單方',gid:12};
 assert.equal(customSupplier(' 新廠 ','單方',[existing]),existing);
 assert.equal(customSupplier('新廠','複方',[existing]).name,'新廠複方');
 for(const x of ['', '其他','錯/名','錯|名','副本廠商','a'.repeat(61)])assert.throws(()=>customSupplier(x,'單方'));
 assert.throws(()=>customSupplier('新廠','其他'));
 assert.equal(itemRegistration(customSupplier('新廠','單方'),'NEW1','藥品','0',[]).sheet,'新廠單方');
});
test('server validates same new supplier names',()=>{
 const ctx=vm.createContext({LOSS3:{inventory:'inventory'}});vm.runInContext(fs.readFileSync('gas/cloud/Cloud.gs','utf8'),ctx);
 assert.equal(ctx.erpNewSupplierName_('新廠複方').brand,'新廠');
 for(const x of ['其他單方','新/廠單方','新廠',' 新廠單方','副本單方'])assert.throws(()=>ctx.erpNewSupplierName_(x));
});
