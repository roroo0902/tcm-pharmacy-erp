import test from 'node:test';
import assert from 'node:assert/strict';
import {lossDraft} from '../web/loss-cloud.mjs';
import {assertLossCompletion,lossCompletionPreview} from '../web/loss-unified.mjs';
import {checkLossResult} from '../web/operation-result.mjs';
import {lossCancellationSummary} from '../web/loss-cancel.mjs';
const draft=lossDraft([],{date:'2026-11-14',actor:'QA',reason:'QA',completionSheets:['科達單方']});
test('zero-only draft still requires explicit category confirmation and operator',()=>{
 assert.deepEqual(draft.lines,[]);assert.equal(draft.confirmBlankZero,true);
 assert.deepEqual(lossCancellationSummary(draft,{date:draft.date,loss:[]}),[]);
 assert.throws(()=>lossDraft([],{date:draft.date,actor:'QA',reason:''}),/至少/);
 assert.throws(()=>lossDraft([],{date:draft.date,actor:'',reason:'',completionSheets:['科達單方']}),/經手人/);
});
test('missing cloud completion cannot be mistaken for success even when no quantities were entered',()=>{
 assert.throws(()=>assertLossCompletion(draft,[],false));
 assert.throws(()=>checkLossResult(draft,{date:draft.date,loss:[]}),e=>e.code==='LOSS_NOT_SYNCED');
 const completion=[{date:draft.date,sheet:'科達單方',eligibleComplete:true,eligibleCount:2,pendingCount:1,pendingItems:[{name:'<img>',reason:'缺編號'}]}];
 assert.equal(checkLossResult(draft,{date:draft.date,loss:[],completion}),true);
 assertLossCompletion(draft,completion,true);
 assert.match(lossCompletionPreview(draft,completion),/&lt;img&gt;/);
 assert.throws(()=>assertLossCompletion(draft,[{...completion[0],eligibleComplete:false}],true));
});
