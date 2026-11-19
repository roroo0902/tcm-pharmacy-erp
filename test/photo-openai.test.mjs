import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=['order-catalog.gs','PhotoVision.gs'].map(file=>fs.readFileSync('gas/cloud/'+file,'utf8')).join('\n');
const input={brand:'科達',mimeType:'image/jpeg',base64:'A'.repeat(100)};
function setup({key='test-only',status=200,body={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({lines:[{name:'陳皮',code:'A083',quantity:2,unit:'瓶',confidence:'high',evidence:'陳皮 2瓶'}]})}]}]}}={}){
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
  PropertiesService:{getScriptProperties:()=>({getProperty:n=>n==='OPENAI_API_KEY'?key:null})},
  Utilities:{base64Decode:()=>[1]},
  UrlFetchApp:{fetch:(url,options)=>{calls.push({url,options});return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(body)};}}
 });
 vm.runInContext(source,ctx);
 return {run:(brand=input.brand)=>ctx.erpRecognizeReceipt_({...input,brand}),calls};
}
test('OpenAI image request uses backend secret, strict schema and no response storage',()=>{const x=setup();assert.equal(x.run().lines[0].name,'陳皮');const c=x.calls[0],r=JSON.parse(c.options.payload);assert.equal(c.url,'https://api.openai.com/v1/responses');assert.equal(c.options.headers.Authorization,'Bearer test-only');assert.equal(r.store,false);assert.equal(r.text.format.strict,true);assert.equal(r.input[0].content[1].type,'input_image');assert.ok(!c.options.payload.includes('test-only'));});
test('missing key makes no network request',()=>{const x=setup({key:null});assert.throws(x.run,/OPENAI_API_KEY/);assert.equal(x.calls.length,0);});
test('failed and incomplete responses never return usable receipt rows',()=>{for(const status of [401,429,500])assert.throws(setup({status}).run);for(const body of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]},{status:'completed',output:[]}])assert.throws(setup({body}).run);});

test('disabled supplier never sends an image to OpenAI',()=>{const x=setup();assert.throws(()=>x.run('停用廠商'),/不支援的廠商/);assert.equal(x.calls.length,0);});
