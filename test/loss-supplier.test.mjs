import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseSupplierCatalog} from '../web/supplier-catalog.mjs';
import {lossPostedRows,lossDraft} from '../web/loss-cloud.mjs';
import {planCumulative} from '../src/loss-cumulative.mjs';
test('loss uses shared new supplier identities and date-specific totals without mixing same codes',()=>{
 const sources=[{name:'科達單方',brand:'科達',category:'單方',gid:1},{name:'新增複方',brand:'新增',category:'複方',gid:2}];
 const sheets=Object.fromEntries(sources.map((s,i)=>{const g=[['','編號','','藥品名稱','價格'],['','','','','','','未拆封'],['','A1','','藥品',200,'',10]];g[0][13]='2026/11/01';g[1][13]='日';g[2][13]=i+2;g[0][14]='2026/10/31';g[1][14]='六';g[2][14]=9;return [s.name,g];}));
 const c=parseSupplierCatalog({sources,sheets});const rows=lossPostedRows(c.rows,c.sheets,'2026-11-01');assert.deepEqual(rows.map(r=>r.posted),[2,3]);assert.notEqual(rows[0].id,rows[1].id);
 const draft=lossDraft(rows.map(row=>({row,total:row.posted+1})),{date:'2026-11-01',actor:'測試',reason:'非實際'});assert.deepEqual(draft.lines.map(l=>l.sheet),sources.map(s=>s.name));
 const plans=planCumulative(rows.map(r=>({key:r.id,before:r.posted,total:r.posted+1,stock:r.bottles})));assert.deepEqual(plans.map(p=>p.stockAfter),[9,9]);
 assert.deepEqual(lossPostedRows(c.rows,c.sheets,'2026-10-31').map(r=>r.posted),[9,9]);assert.deepEqual(lossPostedRows(c.rows,c.sheets,'2026-10-30').map(r=>r.posted),[null,null]);
 sheets.新增複方[0][14]='2026/11/01';assert.equal(lossPostedRows(c.rows,c.sheets,'2026-11-01')[1].posted,null);
});
function backend(){const prepared=[];const c=vm.createContext({console,SpreadsheetApp:{openById:()=>({})},erpOrderSources_:()=>[{name:'新增單方'},{name:'新增複方'}],Utilities:{formatDate:()=> '2026-11-01'},Session:{getActiveUser:()=>({getEmail:()=> 'owner'}),getEffectiveUser:()=>({getEmail:()=> 'owner'})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});vm.runInContext(fs.readFileSync('gas/loss/Code.gs','utf8'),c);c.loss3EnsureDate_=(date,names)=>prepared.push({date,names:Array.from(names)});return {c,prepared};}
const draft=sheet=>({kind:'tcm-loss-cumulative',version:3,date:'2026-11-01',actor:'測試',reason:'',lines:[{sheet,code:'A1',name:'藥品',total:1}]});
test('backend accepts enabled new suppliers and rejects missing or disabled sheets',()=>{const {c}=backend();assert.equal(c.loss3Draft_(draft('新增複方')).lines[0].sheet,'新增複方');assert.throws(()=>c.loss3Draft_(draft('科達單方')),/品項/);assert.throws(()=>c.loss3Draft_(draft('未知單方')),/品項/);});
test('date preparation touches only submitted enabled categories, not every supplier',()=>{const {c,prepared}=backend();c.lossV3PrepareDate(draft('新增複方'));assert.deepEqual(prepared,[{date:'2026-11-01',names:['新增複方']}]);});
