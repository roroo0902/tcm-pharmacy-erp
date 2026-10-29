import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync('gas/cloud/PhotoVision.gs','utf8');
const input={brand:'科達',mimeType:'image/jpeg',base64:'A'.repeat(100)};
function setup({key='test-only',status=200,body={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({lines:[{name:'陳皮',code:'A083',quantity:2,unit:'瓶',confidence:'high',evidence:'陳皮 2瓶'}]})}]}]}}={}){
 const calls=[];const ctx=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:n=>n==='OPENAI_API_KEY'?key:null})},Utilities:{base64Decode:()=>[1]},UrlFetchApp:{fetch:(url,options)=>{calls.push({url,options});return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(body)};}}});vm.runInContext(source,ctx);return {run:()=>ctx.erpRecognizeReceipt_(input),calls};
}
test('OpenAI image request uses backend secret, strict schema and no response storage',()=>{const x=setup();assert.equal(x.run().lines[0].name,'陳皮');const c=x.calls[0],r=JSON.parse(c.options.payload);assert.equal(c.url,'https://api.openai.com/v1/responses');assert.equal(c.options.headers.Authorization,'Bearer test-only');assert.equal(r.store,false);assert.equal(r.text.format.strict,true);assert.equal(r.input[0].content[1].type,'input_image');assert.ok(!c.options.payload.includes('test-only'));});
test('missing key makes no network request',()=>{const x=setup({key:null});assert.throws(x.run,/OPENAI_API_KEY/);assert.equal(x.calls.length,0);});
test('failed and incomplete responses never return usable receipt rows',()=>{for(const status of [401,429,500])assert.throws(setup({status}).run);for(const body of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]},{status:'completed',output:[]}])assert.throws(setup({body}).run);});
