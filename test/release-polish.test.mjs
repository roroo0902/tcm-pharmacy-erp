import test from 'node:test';
import assert from 'node:assert/strict';
import {erpUiRelease,mountReleasePolish} from '../web/release-polish.mjs';
function shell(older=false,missingTitle=false){
 const elements=new Map(),append=node=>elements.set(node.id,node),hero={append};
 return {
  elements, doc:{head:{append},getElementById:id=>elements.get(id),createElement:tag=>({tag}),
   querySelector:selector=>selector==='.hero-copy'&&!older?hero:selector==='#title'&&!missingTitle?{parentElement:hero}:null}
 };
}
test('release polish injects one scoped style and one visible release marker in both shells',()=>{
 for(const older of [false,true]){
  const {elements,doc}=shell(older);
  mountReleasePolish(doc);mountReleasePolish(doc);
  assert.equal(elements.size,2);
  const css=elements.get('erp-release-workbench-style').textContent;
  for(const selector of ['#order-grid-state','#receipt-state','#loss-state','#sh-list','focus-visible','max-width:760px'])assert.ok(css.includes(selector));
  assert.match(css,/grid-template-columns:44px minmax\(48px,1fr\) 44px 16px/);
  assert.equal(elements.get('erp-ui-release').textContent,erpUiRelease);
  assert.equal(erpUiRelease,'介面版本 2026.11.20 R1');
 }
});
test('optional shell hero does not prevent delivery of scoped CSS',()=>{
 const {elements,doc}=shell(true,true);assert.doesNotThrow(()=>mountReleasePolish(doc));
 assert.equal(elements.size,1);assert.ok(elements.has('erp-release-workbench-style'));
});

test('parchment table links use dark readable secondary text, separate from dialog notes',()=>{
 const {elements,doc}=shell();mountReleasePolish(doc);
 const css=elements.get('erp-release-workbench-style').textContent;
 const rule=css.match(/#confirm \.direct-review-table td \.muted\s*\{color:#([a-f0-9]+);font-size:(\d+)px;line-height:([\d.]+)\}/);
 assert.ok(rule);assert.ok(Number(rule[2])>=12);assert.ok(Number(rule[3])>=1.4);
 const linear=c=>c/255<=0.04045?(c/255)/12.92:((c/255+0.055)/1.055)**2.4;
 const lum=h=>h.match(/../g).map(x=>linear(parseInt(x,16))).reduce((a,c,i)=>a+c*[.2126,.7152,.0722][i],0);
 assert.ok((lum('fffbee')+.05)/(lum(rule[1])+.05)>=4.5);
});
