import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function server(email='owner@example.com',allowed='owner@example.com'){
 const calls=[];
 const c=vm.createContext({
  Session:{getActiveUser:()=>({getEmail:()=>email})},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>allowed})},
  LOSS3:{names:['科達單方'],inventory:'stock',log:'loss'},ERP:{inventory:'stock',orders:'orders',log:'inventory',orderLog:'orders'},
  loss3Actor_:()=>calls.push('actor'),lossV3PrepareDate:()=>calls.push('date'),
  lossV3Preview:()=>({token:'loss-token',lines:[{delta:0}]}),
  lossV3Commit:(d,t)=>{calls.push(['loss',t]);return {message:'ok'};},
  erpPreview:d=>({token:'token',lines:d.lines}),erpCommit:(d,t)=>{calls.push(['commit',d.id,t]);return {message:'ok'};},
  SpreadsheetApp:{openById:id=>({getSheetByName:name=>({getLastRow:()=>3,getLastColumn:()=>14,getDataRange:()=>({getDisplayValues:()=>[[id,name]]})})})}
 });vm.runInContext(fs.readFileSync('gas/cloud/Direct.gs','utf8'),c);return {c,calls};
}
test('API gate rejects missing/unauthorized identities before touching Sheets',()=>{
 for(const [email,allowed] of [['','owner@example.com'],['stranger@example.com','owner@example.com'],['owner@example.com','']]){
  const h=server(email,allowed);assert.throws(()=>h.c.erpDirect('readAll'),/尚未獲准/);assert.equal(h.calls.length,0);
 }
});
test('API reads only configured sheets/logs, refuses caller supplied arbitrary targets',()=>{
 const {c}=server();assert.equal(c.erpDirect('readAll').sheets['科達單方'][0][0],'stock');
 assert.equal(c.erpDirect('readLog',{log:'orders',spreadsheetId:'untrusted'}).values[0][0],'orders');
 assert.throws(()=>c.erpDirect('readLog',{log:'__proto__'}),/無效/);
 assert.throws(()=>c.erpDirect('delete',{}),/不支援/);
});
test('API preserves preview token and cumulative loss readback; date preparation does not commit',()=>{
 const {c,calls}=server(),loss={kind:'tcm-loss-cumulative'};
 c.erpDirect('preview',loss);assert.ok(calls.includes('date'));assert.ok(!calls.some(Array.isArray));
 c.erpDirect('commit',{kind:'tcm-cloud',id:'ERP-stable'},'snapshot');
 assert.deepEqual(calls.find(Array.isArray),['commit','ERP-stable','snapshot']);
 c.lossV3Preview=()=>{throw Error('same execution cache');};assert.equal(c.erpDirect('commit',loss,'old').message,'ok');
});

let serial=0;
async function client(t){
 const saved={google:globalThis.google,fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window};
 t.after(()=>{for(const [k,v] of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
 globalThis.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:o=>({requestAccessToken:()=>queueMicrotask(()=>o.callback({access_token:'test-only',expires_in:3600}))})}}};
 globalThis.document={querySelectorAll:()=>[]};globalThis.window={dispatchEvent:()=>{}};
 const source=fs.readFileSync('web/direct-sync.mjs','utf8').replace("import {DIRECT} from './direct-config.mjs';","const DIRECT={enabled:true,clientId:'test-client',deploymentId:'api-deployment',pollMs:15000};");
 const mod=await import('data:text/javascript;base64,'+Buffer.from(source+'\n//'+serial++).toString('base64'));
 return mod;
}
const response=result=>new Response(JSON.stringify({done:true,response:{result}}));
test('client needs login, uses authenticated API deployment, and coalesces six sheet reads',async t=>{
 const m=await client(t);let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.ok(url.endsWith('/api-deployment:run'));assert.equal(init.headers.Authorization,'Bearer test-only');assert.equal(JSON.parse(init.body).devMode,false);return response({sheets:{A:[['x,y','"z"']]}});};
 await assert.rejects(m.runDirect('readAll'),/登入/);assert.equal(calls,0);await m.authorize();
 const list=await Promise.all(Array.from({length:6},()=>m.directSheet({name:'A'})));assert.equal(calls,1);assert.equal(await list[0].text(),'"x,y","""z"""');
 await m.directSheet({name:'A'});assert.equal(calls,2);
});
test('review escapes content, writes nothing before confirm, commits exact reviewed payload and token',async t=>{
 const m=await client(t),calls=[];let confirm,success=0;
 globalThis.fetch=async(url,init)=>{const b=JSON.parse(init.body);calls.push(b.parameters);return response(b.parameters[0]==='preview'?{token:'snapshot',lines:[{name:'<img onerror=x>',quantity:3,before:2,after:5}]}:{message:'ok'});};
 const draft={kind:'tcm-cloud',id:'ERP-stable',lines:[{quantity:3}]};
 await m.directReview(draft,(html,fn)=>{assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);confirm=fn;},async()=>success++,()=>{});
 assert.deepEqual(calls.map(x=>x[0]),['preview']);draft.lines[0].quantity=99;await confirm();
 assert.equal(success,1);assert.equal(calls[1][1].lines[0].quantity,3);assert.equal(calls[1][2],'snapshot');
});
test('expired authorization and ambiguous transport failures never auto-retry a write',async t=>{
 const m=await client(t);await m.authorize();let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({error:{message:'expired'}}),{status:401});};
 await assert.rejects(m.runDirect('commit',{},'token'),/expired/);await assert.rejects(m.runDirect('commit',{},'token'),/登入/);assert.equal(calls,1);
 await m.authorize();globalThis.fetch=async()=>{calls++;throw Error('connection lost');};
 await assert.rejects(m.runDirect('commit',{},'token'),/connection lost/);assert.equal(calls,2);
});

test('loss confirms success only after a separate fresh readback and rejects a nonzero delta',async t=>{
 const m=await client(t);let confirm,success=0,status='',readbacks=0;const ops=[];
 globalThis.fetch=async(url,init)=>{const op=JSON.parse(init.body).parameters[0];ops.push(op);return response(op==='commit'?{message:'ok'}:{token:'snapshot',lines:[{delta:op==='preview'&&ops.at(-2)==='commit'?readbacks:1}]});};
 const review=()=>m.directReview({kind:'tcm-loss-cumulative',lines:[{total:1}]},(html,fn)=>confirm=fn,async()=>success++,s=>status=s);
 await review();await confirm();assert.deepEqual(ops,['preview','commit','preview']);assert.equal(success,1);
 readbacks=1;await review();await confirm();assert.equal(success,1);assert.match(status,/入帳後資料又有變動/);
});

test('API snapshot stays stable when transport reorders nested object keys',()=>{
 const {c}=server();
 c.lossV3Preview=d=>({token:JSON.stringify(d),lines:[]});
 c.lossV3Commit=(d,t)=>{assert.equal(JSON.stringify(d),t);return {message:'ok'};};
 const a={kind:'tcm-loss-cumulative',date:'2026-10-29',lines:[{sheet:'科達單方',code:'QA',total:1}]};
 const b={lines:[{total:1,code:'QA',sheet:'科達單方'}],date:'2026-10-29',kind:'tcm-loss-cumulative'};
 c.erpDirect('commit',b,c.erpDirect('preview',a).token);
 b.lines[0].total=2;
 assert.throws(()=>c.erpDirect('commit',b,c.erpDirect('preview',a).token));
});
