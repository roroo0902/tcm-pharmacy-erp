import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchRecognized, cleanRecognized, addToBasket, normalizeDrug} from '../src/photo-receive-data.mjs';
const rows=[{id:'1',name:'科達單方',code:'A-01',drug:'黃芩',bottles:8},{id:'2',name:'科達單方',code:'B02',drug:'黃連',bottles:3}];
test('normalizes full-width and punctuation',()=>assert.equal(normalizeDrug('Ａ－０１'),'A01'));
test('exact code match but different name flags for review',()=>{
 const result=matchRecognized({code:'A01',name:'黃連'},rows);
 assert.equal(result.row.id,'1');assert.equal(result.warning,true);
});
test('fuzzy or missing names never auto-match',()=>assert.equal(matchRecognized({code:'',name:'黃'},rows).row,null));
test('duplicate codes cannot auto match',()=>assert.equal(matchRecognized({code:'B02'},[...rows,{...rows[1],id:'3'}]).row,null));
test('cleans and limits OCR response',()=>{
 const result=cleanRecognized({lines:[{name:'黃芩',quantity:'5',unit:'瓶',confidence:'high'}]});
 assert.equal(result[0].quantity,'5');assert.equal(result[0].reviewed,false);
 assert.throws(()=>cleanRecognized({lines:Array.from({length:101},()=>({}))}));
});
test('requires human review and valid stock',()=>{
 const l={selected:'1',quantity:'4',reviewed:false};
 assert.throws(()=>addToBasket([], [l],rows,'科達單方'),/勾選/);
 assert.equal(addToBasket([], [{...l,reviewed:true}],rows,'科達單方')[0].quantity,4);
});
test('same item merges and bounds quantity',()=>{
 const item={selected:'1',quantity:'2',reviewed:true};
 const first=addToBasket([], [item],rows,'科達單方');
 assert.equal(addToBasket(first, [item],rows,'科達單方')[0].quantity,4);
 assert.throws(()=>addToBasket(first, [{...item,quantity:'1.5'}],rows,'科達單方'),/整數/);
});
test('no valid line and mismatched sheet cannot be added',()=>{
 assert.throws(()=>addToBasket([], [{selected:'999',quantity:'1',reviewed:true}],rows,'科達單方'),/選擇/);
 assert.throws(()=>addToBasket([], [{selected:'1',quantity:'1',reviewed:true}],[{...rows[0],bottles:null}],'科達單方'),/庫存/);
});