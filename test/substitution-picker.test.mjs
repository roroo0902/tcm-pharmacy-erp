import test from 'node:test';import assert from 'node:assert/strict';import {substitutionChoices} from '../web/substitution-picker.mjs';
test('both substitution selectors can filter all supplier categories and discover new suppliers',()=>{
 const rows=['科達','天明','富田','新增廠商'].flatMap(brand=>['單方','複方'].flatMap(category=>[{brand,category,code:'A1',drug:'有效藥'},{brand,category,code:'',drug:'缺編號'},{brand,category,code:'A2',warning:'同分頁編號重複'}]));const before=JSON.stringify(rows);
 assert.equal(substitutionChoices(rows).brands.length,4);for(const brand of ['科達','天明','富田','新增廠商']){assert.deepEqual(substitutionChoices(rows,brand).categories,['單方','複方']);for(const category of ['單方','複方'])assert.deepEqual(substitutionChoices(rows,brand,category).items.map(r=>r.drug),['有效藥']);}assert.equal(substitutionChoices(rows,'不存在','單方').items.length,0);assert.equal(JSON.stringify(rows),before);
});
