import test from 'node:test';
import assert from 'node:assert/strict';
import {lossReasons,validateLossReason,lossReasonHint} from '../web/loss-reasons.mjs';
test('correction requires explicit selection even with typed text; other requires explanation',()=>{
 assert.throws(()=>validateLossReason('', '有說明', true),/選擇/);
 assert.throws(()=>validateLossReason('other','  ',true),/說明/);
 assert.throws(()=>validateLossReason('other','',false),/說明/);
 assert.equal(validateLossReason('other','實際核對',true),'實際核對');
 assert.equal(validateLossReason('','',false),'');
 for(const [id,,text] of lossReasons.filter(([id])=>id!=='other'))assert.equal(validateLossReason(id,text,true),text);
});
test('wrong item date or supplier explains separate registration',()=>{for(const id of ['item','date','supplier'])assert.match(lossReasonHint(id),/另行登錄/);});
