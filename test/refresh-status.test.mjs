import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshStatus} from '../web/refresh-status.mjs';

function fixture(){
 const status={textContent:'',setAttribute(){}};
 const button={textContent:'重新讀取工作表',disabled:false,attributes:{},ownerDocument:{createElement:()=>status},setAttribute(k,v){this.attributes[k]=v;},insertAdjacentElement(){}};
 let time=new Date('2026-11-04T03:00:00Z');
 return {button,status,indicator:createRefreshStatus(button,()=>time),advance(){time=new Date('2026-11-04T03:01:00Z');}};
}
test('refresh disables repeat clicks and marks completion only after successful read',()=>{
 const f=fixture();f.indicator.start();
 assert.equal(f.button.disabled,true);assert.equal(f.button.textContent,'讀取中…');assert.equal(f.button.attributes['aria-busy'],'true');
 assert.ok(!f.status.textContent.includes('更新時間'));
 f.indicator.finish(true);assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,'重新讀取工作表');assert.equal(f.button.attributes['aria-busy'],'false');assert.match(f.status.textContent,/更新時間：.*11:00:00/);
 const previous=f.status.textContent;f.advance();f.indicator.start();f.indicator.finish(false);
 assert.match(f.status.textContent,/讀取失敗.*已填數量保留.*11:00:00/);assert.ok(!f.status.textContent.includes('11:01:00'));assert.equal(f.button.disabled,false);
 f.indicator.start();f.indicator.finish(true);assert.notEqual(f.status.textContent,previous);assert.match(f.status.textContent,/11:01:00/);
});
test('first failed read permits retry without inventing a successful timestamp',()=>{
 const f=fixture();f.indicator.start();f.indicator.finish(false);assert.equal(f.button.disabled,false);assert.match(f.status.textContent,/請重試/);assert.ok(!f.status.textContent.includes('更新時間'));
});
