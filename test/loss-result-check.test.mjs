import test from 'node:test';
import assert from 'node:assert/strict';
import {createLossResultCheck,showLossCheckResult} from '../web/loss-result-check.mjs';
import {readFileSync} from 'node:fs';
const draft={date:'2026-11-14',lines:[{sheet:'測試單方',code:'TEST',name:'測試品項',total:2}]};
const data={date:draft.date,loss:[{...draft.lines[0],posted:2}]};
function setup(readCloud=async()=>data,extra={}){
 let record={id:'LOSS-TEST',draft,verified:false},writes=0,opens=0,closes=0,changes=0;
 const reports=[];
 const check=createLossResultCheck({readRecord:()=>record,writeRecord:r=>{record=r;writes++;},readCloud,begin:()=>{opens++;return {close(){closes++;}};},blocked:()=>false,disposed:()=>false,report:r=>{assert.equal(opens,closes);reports.push(r);},changed:()=>changes++,...extra});
 return {check,reports,set:r=>record=r,get record(){return record;},get counts(){return {writes,opens,closes,changes};}};
}
test('click shows loading immediately, deduplicates clicks, then reports exact match',async()=>{
 let resolve,calls=0;
 const s=setup(()=>{calls++;return new Promise(r=>resolve=r);});
 const first=s.check();assert.equal(s.counts.opens,1);await s.check();assert.equal(calls,1);
 resolve(data);await first;assert.equal(s.record.verified,true);assert.equal(s.reports[0].state,'success');assert.equal(s.counts.closes,1);
});
test('different totals report not synced and keep original operation and draft',async()=>{
 const s=setup(async()=>({...data,loss:[{...data.loss[0],posted:1}]}));await s.check();
 assert.equal(s.reports[0].state,'pending');assert.equal(s.record.verified,false);assert.equal(s.record.id,'LOSS-TEST');assert.deepEqual(s.record.draft,draft);
});
for(const [name,read] of [['offline',async()=>{throw Error('offline');}],['wrong date',async()=>({...data,date:'2026-11-13'})],['ambiguous identity',async()=>({...data,loss:[data.loss[0],data.loss[0]]})]])test(name+' reports error without overwriting verification',async()=>{
 const s=setup(read);s.set({...s.record,verified:true});await s.check();assert.equal(s.reports[0].state,'error');assert.equal(s.record.verified,true);assert.equal(s.counts.writes,0);assert.equal(s.counts.closes,1);
});
test('same ID edited during lookup rejects stale result',async()=>{
 let resolve;const s=setup(()=>new Promise(r=>resolve=r));const pending=s.check();
 s.set({...s.record,draft:{...draft,actor:'changed'}});resolve(data);await pending;
 assert.equal(s.counts.writes,0);assert.equal(s.reports[0].state,'error');
});
test('leaving page suppresses stale updates and still closes loading',async()=>{
 let resolve,left=false;const s=setup(()=>new Promise(r=>resolve=r),{disposed:()=>left});const pending=s.check();left=true;resolve(data);await pending;assert.equal(s.counts.writes,0);assert.equal(s.reports.length,0);assert.equal(s.counts.closes,1);
});
test('timeout releases dialog and late result cannot verify the operation',async()=>{
 let resolve;const s=setup(()=>new Promise(r=>resolve=r),{timeoutMs:5});await s.check();assert.equal(s.reports[0].state,'error');assert.match(s.reports[0].detail,/逾時/);resolve(data);await Promise.resolve();assert.equal(s.counts.writes,0);assert.equal(s.counts.closes,1);
});
test('active transaction blocks lookup',async()=>{const s=setup(undefined,{blocked:()=>true});await s.check();assert.equal(s.counts.opens,0);assert.equal(s.counts.writes,0);});
test('result dialog opens, renders untrusted details as text, and closes with focus restored',t=>{
 const original=globalThis.document,nodes=[];let focused=false;
 t.after(()=>globalThis.document=original);
 globalThis.document={activeElement:{isConnected:true,focus(){focused=true;}},body:{append(n){nodes.push(n);}},createElement:tag=>({tag,dataset:{},children:[],events:{},setAttribute(){},addEventListener(k,v){this.events[k]=v;},append(...nodes){this.children.push(...nodes);},showModal(){this.open=true;},close(){this.open=false;this.events.close();},remove(){this.removed=true;}})};
 showLossCheckResult({state:'error',title:'查詢失敗',detail:'<img src=x onerror=alert(1)>'});
 const dialog=nodes[0];assert.equal(dialog.open,true);assert.equal(dialog.children[1].textContent,'<img src=x onerror=alert(1)>');assert.equal(dialog.children[1].innerHTML,undefined);
 dialog.children[3].onclick();assert.equal(dialog.removed,true);assert.equal(focused,true);
});
test('quill remains vector-only with integer scaling and no rotation',()=>{
 const svg=readFileSync(new URL('../web/assets/magic-quill.svg',import.meta.url),'utf8');
 assert.match(svg,/viewBox="0 0 80 72"/);assert.match(svg,/shape-rendering="crispEdges"/);assert.doesNotMatch(svg,/<image|data:image|rotate\(/);
 const screen=readFileSync(new URL('../web/processing-screen.mjs',import.meta.url),'utf8');assert.match(screen,/width:160px;height:144px/);assert.doesNotMatch(screen,/width:140px/);assert.match(screen,/image-rendering:pixelated/);
});
