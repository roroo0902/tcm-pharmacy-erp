import test from 'node:test';
import assert from 'node:assert/strict';
import {adjustedQuantity as adjust} from '../web/quantity-stepper.mjs';
test('receipt buttons preserve untouched blank and valid positive bottle counts',()=>{
 assert.equal(adjust('',-1,{min:1}),'');assert.equal(adjust('',1,{min:1}),'1');
 assert.equal(adjust('1',-1,{min:1}),'1');assert.equal(adjust('2',1,{min:1}),'3');
 assert.equal(adjust('1000000',1,{min:1}),'1000000');assert.equal(adjust('1.5',1,{min:1}),'1.5');
});
test('loss adjusts from posted cumulative amount and retains explicit zero',()=>{
 assert.equal(adjust('',1,{base:5}),'6');assert.equal(adjust('',-1,{base:5}),'4');
 assert.equal(adjust('1',-1),'0');assert.equal(adjust('0',-1),'0');
});
