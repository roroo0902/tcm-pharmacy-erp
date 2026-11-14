import test from 'node:test';import assert from 'node:assert/strict';import{beginProcessing,isProcessing}from '../web/processing-screen.mjs';
test('processing blocks Escape/unload and restores the page after success or failure',t=>{
 const oldDoc=globalThis.document,oldWin=globalThis.window;const nodes=[],events=new Map();let focus=0;
 t.after(()=>{globalThis.document=oldDoc;globalThis.window=oldWin;});
 const detail={textContent:''},write={classList:{add(v){this.value=v;}}};
 globalThis.document={activeElement:{isConnected:true,focus(){focus++;}},getElementById:()=>null,head:{append(){}},body:{style:{overflow:'auto'},append(e){nodes.push(e);}},createElement:tag=>({dataset:{},attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.events[k]=v;},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;},querySelector:s=>s==='.step-write'?write:detail})};
 globalThis.window={addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};
 for(let i=0;i<2;i++){const screen=beginProcessing(),dialog=nodes.at(-1);assert.equal(isProcessing(),true);assert.throws(()=>beginProcessing(),/仍在入帳/);let cancelled=false;dialog.events.cancel({preventDefault(){cancelled=true;}});assert.ok(cancelled);assert.ok(dialog.open);const event={preventDefault(){this.prevented=true;}};events.get('beforeunload')(event);assert.ok(event.prevented);screen.readback();assert.equal(dialog.dataset.stage,'readback');screen.close();screen.close();assert.equal(isProcessing(),false);assert.equal(events.size,0);assert.ok(dialog.removed);}assert.equal(focus,2);const reading=beginProcessing({reading:true});assert.equal(nodes.at(-1).dataset.stage,'reading');assert.equal(document.body.style.overflow,'hidden');reading.close();assert.equal(document.body.style.overflow,'auto');assert.equal(isProcessing(),false);
});

test('daily loss catalog shows the magnifier and restores the page when the read ends',t=>{
 const previousDoc=globalThis.document,previousWin=globalThis.window;
 const fields=new Map(),events=new Set();let dialog;
 t.after(()=>{globalThis.document=previousDoc;globalThis.window=previousWin;});
 globalThis.document={
  getElementById:()=>null,head:{append(){}},body:{style:{overflow:'auto'},append(node){dialog=node;}},
  createElement:()=>({dataset:{},setAttribute(){},addEventListener(){},showModal(){this.open=true;},
   close(){this.open=false;},remove(){this.removed=true;},
   querySelector(selector){if(!fields.has(selector))fields.set(selector,{});return fields.get(selector);}
  })
 };
 globalThis.window={addEventListener:event=>events.add(event),removeEventListener:event=>events.delete(event)};
 const message='正在讀取共用廠商品項與當日累計…';
 const screen=beginProcessing({reading:true,catalogMessage:message});
 try{
  assert.equal(dialog.open,true);
  assert.match(dialog.innerHTML,/catalog-magnifier\.svg/);
  assert.equal(fields.get('#save-heading').textContent,message);
  assert.equal(fields.get('.save-steps').hidden,true);
  assert.equal(events.has('beforeunload'),false);
 }finally{screen.close();}
 assert.equal(isProcessing(),false);
 assert.equal(dialog.removed,true);
 assert.equal(document.body.style.overflow,'auto');
});
