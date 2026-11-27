import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {createHash} from 'node:crypto';import {confirmedPrintPlan} from '../src/order-print.mjs';import {orderPdfHtml,orderMailRoster} from '../src/order-pdf.mjs';
const id='ERP-12345678',draft={kind:'tcm-cloud',version:1,id,action:'訂貨',date:'2026-11-17',actor:'測試',note:'',lines:[{sheet:'科達單方',code:'A1',name:'藥<&',quantity:3},{sheet:'天明複方',code:'B1',name:'別牌',quantity:2}]};
function server(){const props=new Map([['ERP_ALLOWED_EMAILS','owner']]),cache=new Map(),sent=[],events=[{draft}],roster=[['員工姓名','email'],['甲','a@example.com'],['乙','bad']];let fail=false,quota=10;const blob=html=>({getBytes:()=>Array.from(Buffer.from(html)),setName(n){this.name=n;return this;},getName(){return this.name;}});const c=vm.createContext({confirmedPrintPlan_:confirmedPrintPlan,ERP:{orders:'orders',inventory:'inventory',orderLog:'log'},loss3Actor_:()=>{},loss3Hash_:v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),Session:{getActiveUser:()=>({getEmail:()=> 'owner'})},PropertiesService:{getScriptProperties:()=>({getProperties:()=>Object.fromEntries(props),getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},CacheService:{getUserCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},Utilities:{getUuid:()=>String(cache.size+1),base64Encode:b=>Buffer.from(b).toString('base64')},HtmlService:{createHtmlOutput:h=>({getAs:()=>blob(h)})},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:m=>{sent.push(m);if(fail)throw Error('network');}},SpreadsheetApp:{openById:book=>({getSheetByName:()=>({getLastRow:()=>book==='orders'?events.length+1:roster.length,getRange:()=>({getValue:()=> '交易編號',getValues:()=>events.map(e=>[e.draft.id,JSON.stringify(e)]),getDisplayValues:()=>roster})})})}});vm.runInContext(fs.readFileSync('gas/cloud/OrderDelivery.gs','utf8'),c);return {c,props,sent,roster,events,setFail:()=>fail=true,setQuota:n=>quota=n};}
test('PDF separates brands and escapes medicine text',()=>{const p=confirmedPrintPlan([{draft}],id),html=orderPdfHtml(p[0]);assert.match(html,/藥&lt;&amp;/);assert.ok(!html.includes('別牌'));assert.match(orderPdfHtml(p[1]),/別牌/);const wide={...p[0],values:p[0].values.map(r=>[...r,...r,...r,...r])};assert.equal((orderPdfHtml(wide).match(/<section>/g)||[]).length,2);});
test('roster retains source row identity and rejects empty/invalid emails',()=>{const r=orderMailRoster([['員工姓名','email'],['同名','a@b.com'],['同名',''],['丙','a@b.com,c@d.com']]);assert.deepEqual(r.map(s=>[s.row,s.valid]),[[2,true],[3,false],[4,false]]);});
test('download and preview are read-only; sending is explicit and idempotent',()=>{const h=server(),before=JSON.stringify(h.events);const pdf=h.c.erpOrderPdfDownload(id);assert.equal(pdf.files.length,2);const p=h.c.erpOrderPdfMailPreview({id,row:2,test:true,email:'attacker@example.com'});assert.equal(p.email,'a@example.com');assert.equal(p.plans,undefined);assert.equal(h.sent.length,0);const result=h.c.erpOrderPdfMailSend(p.token);assert.equal(result.state,'sent');assert.equal(h.sent[0].to,'a@example.com');assert.equal(h.sent[0].attachments.length,2);assert.match(h.sent[0].subject,/功能測試/);assert.equal(h.c.erpOrderPdfMailSend(p.token).duplicate,true);assert.equal(h.sent.length,1);assert.equal(JSON.stringify(h.events),before);});
test('changed recipient, invalid address, missing order, quota or authorization prevent sends',()=>{for(const mode of ['changed','invalid','missing','quota','auth']){const h=server();if(mode==='invalid'){assert.throws(()=>h.c.erpOrderPdfMailPreview({id,row:3}));continue;}if(mode==='missing'){assert.throws(()=>h.c.erpOrderPdfDownload('ERP-87654321'));continue;}const p=h.c.erpOrderPdfMailPreview({id,row:2});if(mode==='changed')h.roster[1][1]='other@example.com';if(mode==='quota')h.setQuota(0);if(mode==='auth')h.props.set('ERP_ALLOWED_EMAILS','someone');assert.throws(()=>h.c.erpOrderPdfMailSend(p.token));assert.equal(h.sent.length,0);}});
test('uncertain send is never repeated',()=>{const h=server(),p=h.c.erpOrderPdfMailPreview({id,row:2});h.setFail();assert.throws(()=>h.c.erpOrderPdfMailSend(p.token),/待確認/);assert.throws(()=>h.c.erpOrderPdfMailSend(p.token),/待確認/);assert.equal(h.sent.length,1);});
test('cancelled orders cannot be downloaded or mailed',()=>{const h=server();h.events.push({draft:{id:'ERP-87654321',reverses:id,action:'取消訂貨'}});assert.throws(()=>h.c.erpOrderPdfDownload(id));assert.throws(()=>h.c.erpOrderPdfMailPreview({id,row:2}));assert.equal(h.sent.length,0);});
function editable(h){return {...h.c.erpOrderPdfEditSource(id),rows:h.c.erpOrderPdfEditSource(id).rows.map(r=>({...r}))};}
test('PDF draft revises quantities and adds manual brand without changing formal ledger',()=>{const h=server(),before=JSON.stringify(h.events),d=editable(h);d.rows[0].quantity=88;d.rows=d.rows.filter(r=>r.brand!=='天明');d.rows.push({manual:true,brand:'富田',category:'複方',name:'手動測試方',quantity:4},{manual:true,brand:'科達',category:'',name:'',quantity:''});const review=h.c.erpOrderPdfDraftPreview({id,draft:d});assert.deepEqual(Array.from(review.groups,g=>g.brand),['科達','富田']);assert.equal(review.groups[0].items[0].quantity,88);const pdf=h.c.erpOrderPdfDownload({id,draft:d});assert.equal(pdf.files.length,2);assert.match(Buffer.from(pdf.files[1].base64,'base64').toString(),/\[手動新增\] 手動測試方/);assert.equal(JSON.stringify(h.events),before);const p=h.c.erpOrderPdfMailPreview({id,row:2,draft:d});h.c.erpOrderPdfMailSend(p.token);assert.match(Buffer.from(h.sent[0].attachments[0].getBytes()).toString(),/>88<\/td>/);assert.match(Buffer.from(h.sent[0].attachments[1].getBytes()).toString(),/手動測試方/);assert.equal(JSON.stringify(h.events),before);});
test('PDF draft rejects incomplete, fractional, zero, negative, duplicate or spoofed items',()=>{for(const mutate of [d=>d.rows.push({manual:true,brand:'科達',category:'單方',name:'新藥',quantity:''}),d=>d.rows.push({manual:true,brand:'科達',category:'單方',name:'',quantity:1}),d=>d.rows[0].quantity=1.5,d=>d.rows[0].quantity=0,d=>d.rows[0].quantity=-1,d=>d.rows.push({...d.rows[0]}),d=>d.rows[0].key='fake',d=>d.rows.push({manual:true,brand:'科達',category:'單方',name:'藥<&',quantity:1}),d=>d.rows=[],d=>d.sourceHash='stale']){const h=server(),d=editable(h);mutate(d);assert.throws(()=>h.c.erpOrderPdfDownload({id,draft:d}));assert.equal(h.sent.length,0);}});
test('PDF draft protects original names and requires new review after order changes',()=>{const h=server(),d=editable(h);d.rows[0].name='偽造';d.rows[0].brand='富田';const p=h.c.erpOrderPdfDraftPreview({id,draft:d});assert.equal(p.groups[0].items[0].name,'藥<&');assert.equal(p.groups[0].brand,'科達');const mail=h.c.erpOrderPdfMailPreview({id,row:2,draft:d});h.events[0]={draft:{...draft,lines:draft.lines.map((r,i)=>({...r,quantity:i?2:9}))}};assert.throws(()=>h.c.erpOrderPdfMailSend(mail.token),/原訂單已變更/);assert.equal(h.sent.length,0);});

function mergedFixture(){const h=server(),previous={...draft,id:'ERP-previous1',date:'2026-11-16',lines:[{sheet:'科達單方',code:'A1',name:'藥<&',quantity:4},{sheet:'富田單方',code:'F1',name:'另一藥',quantity:1}]};h.events.unshift({draft:previous});const source=h.c.erpOrderPdfEditSource({id,mergeIds:[previous.id]});return {...h,previous,source};}
test('merge is read-only, sums by sheet/code and retains quantities and source identity',()=>{const h=mergedFixture(),before=JSON.stringify(h.events),d=h.source;assert.equal(d.rows.find(x=>x.code==='A1').quantity,7);assert.equal(d.rows.find(x=>x.code==='A1').parts.previous,4);assert.equal(d.rows.find(x=>x.code==='A1').parts.current,3);assert.equal(d.rows.find(x=>x.code==='F1').quantity,1);const pdf=h.c.erpOrderPdfDownload({id,draft:d});assert.equal(pdf.files.length,3);assert.match(Buffer.from(pdf.files[0].base64,'base64').toString(),/更新版，取代前版，請勿重複下單/);assert.match(pdf.files[0].name,/合併更新版/);assert.equal(JSON.stringify(h.events),before);const single=h.c.erpOrderPdfEditSource(id);assert.equal(single.rows[0].quantity,3);assert.equal(single.rows.length,2);});
test('merge rejects same order, future order, cancelled source and mismatched names',()=>{const h=mergedFixture();assert.throws(()=>h.c.erpOrderPdfEditSource({id,mergeIds:[id]}));assert.throws(()=>h.c.erpOrderPdfEditSource({id:h.previous.id,mergeIds:[id]}));h.events.push({draft:{id:'ERP-cancel11',action:'取消訂貨',reverses:h.previous.id}});assert.throws(()=>h.c.erpOrderPdfDownload({id,draft:h.source}),/取消/);const g=mergedFixture();g.previous.lines[0].name='不同名稱';assert.throws(()=>g.c.erpOrderPdfEditSource({id,mergeIds:[g.previous.id]}),/藥名不一致/);});
test('merge mail previews use the selected sources, protect against cancellation and prevent duplicates',()=>{const h=mergedFixture(),before=JSON.stringify(h.events);const p=h.c.erpOrderPdfMailPreview({id,row:2,draft:h.source});assert.match(p.subject,/更新版/);assert.equal(h.sent.length,0);h.c.erpOrderPdfMailSend(p.token);assert.equal(h.sent[0].attachments.length,3);assert.match(h.sent[0].body,/來源訂單：訂貨登入-/);assert.ok(!h.sent[0].body.includes(h.previous.id));assert.equal(h.c.erpOrderPdfMailSend(p.token).duplicate,true);assert.equal(h.sent.length,1);assert.equal(JSON.stringify(h.events),before);const g=mergedFixture(),q=g.c.erpOrderPdfMailPreview({id,row:2,draft:g.source});g.events.push({draft:{id:'ERP-cancel12',action:'取消訂貨',reverses:g.previous.id}});assert.throws(()=>g.c.erpOrderPdfMailSend(q.token));assert.equal(g.sent.length,0);});
test('prior candidates exclude cancelled and test orders and show legacy sent state',()=>{const h=mergedFixture();const old=h.c.erpOrderPdfMailPreview({id:h.previous.id,row:2,test:true});h.c.erpOrderPdfMailSend(old.token);h.props.delete('order-mail-sent-'+h.previous.id);const opts=h.c.erpOrderOutputOptions(id);assert.equal(opts.orders.length,1);assert.equal(opts.orders[0].sent,true);h.events.push({draft:{id:'ERP-cancel13',action:'取消訂貨',reverses:h.previous.id}});assert.equal(h.c.erpOrderOutputOptions(id).orders.length,0);});

test('followup status is read-only and distinguishes unsent, sent and uncertain',()=>{
 const h=server(),before=JSON.stringify(h.events);assert.equal(h.c.erpOrderFollowupStatus(id).state,'unsent');assert.equal(JSON.stringify(h.events),before);assert.equal(h.sent.length,0);
 const p=h.c.erpOrderPdfMailPreview({id,row:2});h.c.erpOrderPdfMailSend(p.token);assert.equal(h.c.erpOrderFollowupStatus(id).state,'sent');
 const g=server(),q=g.c.erpOrderPdfMailPreview({id,row:2});g.setFail();assert.throws(()=>g.c.erpOrderPdfMailSend(q.token));assert.equal(g.c.erpOrderFollowupStatus(id).state,'uncertain');
});
test('followup rejects missing and cancelled orders and tracks revised draft failures',()=>{
 const h=server(),d=editable(h);d.rows[0].quantity=9;const p=h.c.erpOrderPdfMailPreview({id,row:2,draft:d});h.setFail();assert.throws(()=>h.c.erpOrderPdfMailSend(p.token));assert.equal(h.c.erpOrderFollowupStatus(id).state,'uncertain');
 assert.throws(()=>h.c.erpOrderFollowupStatus('ERP-missing'));h.events.push({draft:{id:'ERP-cancel',action:'取消訂貨',reverses:id}});assert.throws(()=>h.c.erpOrderFollowupStatus(id));
});

test('legacy uncertain source allows fresh confirmation of the same PDF and recipient',()=>{
 const h=mergedFixture(),before=JSON.stringify(h.events);
 h.props.set('order-mail-state-'+h.previous.id,'uncertain');
 const input={id,row:2,draft:h.source};
 const first=h.c.erpOrderPdfMailPreview(input);
 assert.equal(first.previousState,'uncertain');
 assert.equal(first.state,'ready');
 assert.equal(h.sent.length,0);
 assert.equal(h.c.erpOrderPdfMailSend(first.token).duplicate,false);
 const second=h.c.erpOrderPdfMailPreview(input);
 assert.equal(second.previousState,'sent');
 assert.equal(second.state,'ready');
 assert.notEqual(second.token,first.token);
 assert.equal(h.c.erpOrderPdfMailSend(second.token).duplicate,false);
 assert.equal(h.c.erpOrderPdfMailSend(first.token).duplicate,true);
 assert.equal(h.c.erpOrderPdfMailSend(second.token).duplicate,true);
 assert.equal(h.sent.length,2);
 assert.deepEqual(h.sent.map(message=>message.to),['a@example.com','a@example.com']);
 assert.deepEqual(h.sent[0].attachments.map(file=>file.getBytes()),h.sent[1].attachments.map(file=>file.getBytes()));
 assert.equal(JSON.stringify(h.events),before);
});
test('a fresh confirmation can retry an uncertain attempt, while its original token stays blocked',()=>{
 const h=server(),input={id,row:2};
 const first=h.c.erpOrderPdfMailPreview(input);
 h.setFail();assert.throws(()=>h.c.erpOrderPdfMailSend(first.token),/待確認/);
 const second=h.c.erpOrderPdfMailPreview(input);
 assert.equal(second.previousState,'uncertain');
 assert.equal(second.state,'ready');
 assert.throws(()=>h.c.erpOrderPdfMailSend(first.token),/待確認/);
 assert.equal(h.sent.length,1);
 assert.throws(()=>h.c.erpOrderPdfMailSend(second.token),/待確認/);
 assert.equal(h.sent.length,2);
});

// Three independent rounds exercise union completeness through source, preview and PDF HTML.
for(let round=1;round<=3;round++){
 const line=(sheet,code,quantity)=>({sheet,code,name:'QA-'+sheet+'-'+code,quantity});
 const cases=[
  ['disjoint',[line('科達單方','X',round)],[line('科達單方','Y',round+1)]],
  ['same-item sums',[line('科達單方','X',round)],[line('科達單方','X',round+2)]],
  ['cross-brand/category',[line('科達單方','X',round),line('天明單方','X',2)],[line('科達複方','X',3),line('富田複方','X',4)]],
  ['multi-page union',Array.from({length:25},(_,i)=>line('科達單方','P'+i,i+1)),Array.from({length:24},(_,i)=>line('科達單方','C'+i,i+2))]
 ];
 for(const [label,previous,current] of cases)test(`merge round ${round}: ${label} has no missing line or quantity`,()=>{
  const h=server();h.c.MailApp.sendEmail=()=>assert.fail('No mail allowed');
  const old={...draft,id:'ERP-old-12345678-'+round,date:'2026-11-16',lines:previous};h.events.splice(0,h.events.length,{draft:old},{draft:{...draft,lines:current}});
  const before=JSON.stringify(h.events),expected=new Map();
  for(const l of [...previous,...current]){const k=l.sheet+'|'+l.code;expected.set(k,(expected.get(k)||0)+l.quantity);}
  const source=h.c.erpOrderPdfEditSource({id,mergeIds:[old.id]});
  assert.equal(source.rows.length,expected.size);
  for(const r of source.rows){assert.equal(r.quantity,expected.get(r.key));assert.equal(r.parts.previous+r.parts.current,r.quantity);}
  const review=h.c.erpOrderPdfDraftPreview({id,draft:source}),items=Array.from(review.groups).flatMap(g=>Array.from(g.items));
  assert.equal(items.length,expected.size);assert.equal(items.reduce((n,l)=>n+l.quantity,0),[...expected.values()].reduce((a,b)=>a+b,0));
  for(const r of source.rows){const found=items.filter(x=>x.name===r.name);assert.equal(found.length,1);assert.equal(found[0].quantity,r.quantity);}
  const pdf=h.c.erpOrderPdfDownload({id,draft:source});
  assert.equal(pdf.files.length,new Set(source.rows.map(r=>r.brand)).size);
  for(const file of pdf.files){const html=Buffer.from(file.base64,'base64').toString();const actual=[...html.matchAll(/<td>(QA-[^<]+)<\/td><td>(\d+)<\/td>/g)].map(m=>({name:m[1],quantity:Number(m[2])}));const wanted=source.rows.filter(r=>r.brand===file.brand);assert.equal(actual.length,wanted.length);for(const r of wanted){assert.equal(actual.filter(x=>x.name===r.name&&x.quantity===r.quantity).length,1);}}
  assert.equal(JSON.stringify(h.events),before);assert.equal(h.sent.length,0);
 });
 test(`merge round ${round}: cancellation and duplicate ID selection are rejected`,()=>{
  const h=mergedFixture();h.c.MailApp.sendEmail=()=>assert.fail('No mail allowed');
  assert.throws(()=>h.c.erpOrderPdfEditSource({id,mergeIds:[id]}));
  assert.throws(()=>h.c.erpOrderPdfEditSource({id,mergeIds:[h.previous.id,h.previous.id]}));
  h.events.push({draft:{id:'ERP-cancel-merge',action:'取消訂貨',reverses:h.previous.id}});
  assert.throws(()=>h.c.erpOrderPdfDraftPreview({id,draft:h.source}));assert.throws(()=>h.c.erpOrderPdfDownload({id,draft:h.source}));
  const g=mergedFixture();g.events.push({draft:{id:'ERP-cancel-current',action:'取消訂貨',reverses:id}});assert.throws(()=>g.c.erpOrderPdfEditSource({id,mergeIds:[g.previous.id]}));assert.equal(h.sent.length,0);assert.equal(g.sent.length,0);
 });
}

for(let round=1;round<=3;round++)test(`unposted merge round ${round}: union, same-item sum and category boundaries`,async()=>{
 const {mergeUnpostedOrders}=await import('../web/order-merge-draft.mjs');
 const l=(sheet,code,quantity)=>({sheet,code,name:'QA-'+sheet+'-'+code,quantity});
 const a={...draft,lines:[l('科達單方','X',round),l('天明單方','Y',2)]};
 const b={...draft,id:'ERP-second-12345678',lines:[l('科達單方','X',round+1),l('科達複方','X',3),l('富田單方','Z',4)]};
 const before=JSON.stringify([a,b]),merged=mergeUnpostedOrders(a,b);
 assert.equal(merged.id,a.id);assert.equal(merged.lines.length,4);
 assert.equal(merged.lines.find(x=>x.sheet==='科達單方').quantity,round*2+1);
 assert.equal(merged.lines.reduce((n,x)=>n+x.quantity,0),round*2+10);
 assert.equal(JSON.stringify([a,b]),before);
});

test('existing and merged orders show each original Taipei timestamp through selection, PDF and mail',()=>{
 const h=mergedFixture();
 h.events[0].time='2026-11-25T17:03:05.000Z';
 h.events[1].time='2026-11-27T08:09:10.000Z';
 const previous='訂貨登入-2026-11-26 01:03:05',current='訂貨登入-2026-11-27 16:09:10';
 const option=h.c.erpOrderOutputOptions(id).orders[0];
 assert.equal(option.id,h.previous.id);
 assert.equal(option.time,h.events[0].time);
 const pdf=h.c.erpOrderPdfDownload({id,draft:h.source}).files[0];
 const html=Buffer.from(pdf.base64,'base64').toString();
 for(const label of [previous,current])assert.ok(html.includes(label));
 assert.ok(!html.includes(id)&&!html.includes(h.previous.id));
 const preview=h.c.erpOrderPdfMailPreview({id,row:2,draft:h.source});
 h.c.erpOrderPdfMailSend(preview.token);
 for(const label of [previous,current])assert.ok(h.sent[0].body.includes(label));
});
