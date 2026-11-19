import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=['order-catalog.gs','PhotoVision.gs'].map(file=>fs.readFileSync('gas/cloud/'+file,'utf8')).join('\n');
const input={brand:'科達',mimeType:'image/jpeg',base64:'A'.repeat(100)};
function setup({key='test-only',model=null,status=200,fetchError,body={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({lines:[{name:'陳皮',code:'A083',quantity:2,unit:'瓶',confidence:'high',evidence:'陳皮 2瓶'}]})}]}]}}={}){
 const calls=[];
 const inventory={
  getSheets:()=>['科達單方','停用廠商單方'].map((name,index)=>({getSheetId:()=>index+1,getName:()=>name})),
  getSheetByName:name=>name==='廠商設定'?{getDataRange:()=>({getValues:()=>[
   ['啟用','廠商','類別','工作表ID','顯示順序'],
   [true,'科達','單方',1,1],
   [false,'停用廠商','單方',2,2]
  ]})}:null
 };
 const ctx=vm.createContext({
  ERP:{inventory:'test-inventory'},
  SpreadsheetApp:{openById:id=>{assert.equal(id,'test-inventory');return inventory;}},
  PropertiesService:{getScriptProperties:()=>({getProperty:n=>n==='OPENAI_API_KEY'?key:n==='ERP_OPENAI_VISION_MODEL'?model:null})},
  Utilities:{base64Decode:()=>[1]},
  UrlFetchApp:{fetch:(url,options)=>{calls.push({url,options});if(fetchError)throw fetchError;return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(body)};}}
 });
 vm.runInContext(source,ctx);
 return {run:(brand=input.brand)=>ctx.erpRecognizeReceipt_({...input,brand}),calls};
}
test('OpenAI image request uses backend secret, strict schema and no response storage',()=>{const x=setup();assert.equal(x.run().lines[0].name,'陳皮');const c=x.calls[0],r=JSON.parse(c.options.payload);assert.equal(c.url,'https://api.openai.com/v1/responses');assert.equal(c.options.headers.Authorization,'Bearer test-only');assert.equal(r.store,false);assert.equal(r.text.format.strict,true);assert.equal(r.input[0].content[1].type,'input_image');assert.ok(!c.options.payload.includes('test-only'));});
test('missing key makes no network request',()=>{const x=setup({key:null});assert.throws(x.run,/OPENAI_API_KEY/);assert.equal(x.calls.length,0);});
test('failed and incomplete responses never return usable receipt rows',()=>{for(const status of [401,429,500])assert.throws(setup({status}).run);for(const body of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]},{status:'completed',output:[]}])assert.throws(setup({body}).run);});

test('disabled supplier never sends an image to OpenAI',()=>{const x=setup();assert.throws(()=>x.run('停用廠商'),/不支援的廠商/);assert.equal(x.calls.length,0);});

test('missing Apps Script external request permission is reported without exposing credentials',()=>{const x=setup({fetchError:Error('Permission denied: script.external_request test-only')});assert.throws(x.run,{message:'AI 辨識需要 Apps Script 的外部連線授權，請由部署帳號授權後再試'});});

test('model metadata preserves default and override without secret',()=>{const a=setup().run();assert.equal(a.model,null);assert.equal(a.requestedModel,'gpt-4.1-mini');assert.ok(!JSON.stringify(a).includes('test-only'));const x=setup({model:'custom-vision'});assert.equal(x.run().requestedModel,'custom-vision');assert.equal(JSON.parse(x.calls[0].options.payload).model,'custom-vision');const body={status:'completed',model:'gpt-4.1-mini-2025-04-14',output:[{type:'message',content:[{type:'output_text',text:'{"lines":[]}'}]}]};assert.equal(setup({body}).run().model,body.model);body.model='test-only';assert.equal(setup({body}).run().model,null);});

test('OCR request explicitly requires row-local visible codes and blanks, with no borrowing or inference',()=>{
 const x=setup();x.run();const prompt=JSON.parse(x.calls[0].options.payload).instructions;
 for(const requirement of ['code 只能抄錄本列清楚可見的印刷品號','本列未印品號或無法確定時，code 必須為空字串','不得借用上一列、下一列或其他列的品號','不得依藥名或常見編號推測補上'])assert.ok(prompt.includes(requirement),requirement);
});
test('row-local OCR guidance does not weaken code/name conflict protection',async()=>{
 const {matchRecognized,cleanRecognized,addToBasket}=await import('../src/photo-receive-data.mjs');
 const rows=[{id:'1',code:'B1109',drug:'甘麥大棗湯',brand:'科達',name:'科達複方',category:'複方',bottles:0},{id:'2',code:'B1043',drug:'香砂六君子',brand:'科達',name:'科達複方',category:'複方',bottles:0}];
 const line={name:'香砂六君子湯 濃縮細粒',quantity:1,unit:'瓶',evidence:'200g'};
 assert.equal(matchRecognized({...line,code:''},rows).row.code,'B1043');
 const conflict=matchRecognized({...line,code:'B1109'},rows);assert.equal(conflict.row,null);assert.equal(conflict.warning,true);assert.match(conflict.reason,/衝突/);
 const unknown=matchRecognized({...line,code:'B9999'},rows);assert.equal(unknown.row,null);
 const pending=cleanRecognized({lines:[{...line,code:''}]});pending[0].selected='2';assert.throws(()=>addToBasket([],pending,rows,'科達'),/核對/);
});
