import test from 'node:test';import assert from 'node:assert/strict';import{beginProcessing,isProcessing}from '../web/processing-screen.mjs';
test('processing blocks Escape/unload and restores the page after success or failure',t=>{
 const oldDoc=globalThis.document,oldWin=globalThis.window;const nodes=[],events=new Map(),handles=[];let focus=0;
 t.after(()=>{for(const handle of handles)handle.close();globalThis.document=oldDoc;globalThis.window=oldWin;});
 const detail={textContent:''},write={classList:{add(v){this.value=v;}}};
 globalThis.document={activeElement:{isConnected:true,focus(){focus++;}},getElementById:()=>null,head:{append(){}},body:{style:{overflow:'auto'},append(e){nodes.push(e);}},createElement:tag=>({dataset:{},attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.events[k]=v;},removeEventListener(k){delete this.events[k];},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;},querySelector:s=>s==='.step-write'?write:detail})};
 globalThis.window={addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};
 for(let i=0;i<2;i++){const screen=beginProcessing(),dialog=nodes.at(-1);handles.push(screen);assert.equal(document.body.style.overflow,'hidden');assert.equal(isProcessing(),true);assert.throws(()=>beginProcessing(),/仍在入帳/);let cancelled=false;dialog.events.cancel({preventDefault(){cancelled=true;}});assert.ok(cancelled);assert.ok(dialog.open);const event={preventDefault(){this.prevented=true;}};events.get('beforeunload')(event);assert.ok(event.prevented);screen.readback();assert.equal(dialog.dataset.stage,'readback');screen.close();screen.close();assert.equal(isProcessing(),false);assert.equal(events.size,0);assert.ok(dialog.removed);}assert.equal(focus,2);const reading=beginProcessing({reading:true});handles.push(reading);assert.equal(nodes.at(-1).dataset.stage,'reading');assert.equal(document.body.style.overflow,'auto');assert.equal(typeof nodes.at(-1).events.wheel,'function');reading.close();assert.equal(nodes.at(-1).events.wheel,undefined);assert.equal(document.body.style.overflow,'auto');assert.equal(isProcessing(),false);
});

test('daily loss catalog shows the magnifier and restores the page when the read ends',t=>{
 const previousDoc=globalThis.document,previousWin=globalThis.window;
 const fields=new Map(),events=new Set();let dialog;
 t.after(()=>{globalThis.document=previousDoc;globalThis.window=previousWin;});
 globalThis.document={
  getElementById:()=>null,head:{append(){}},body:{style:{overflow:'auto'},append(node){dialog=node;}},
  createElement:()=>({dataset:{},setAttribute(){},addEventListener(){},removeEventListener(){},showModal(){this.open=true;},
   close(){this.open=false;},remove(){this.removed=true;},
   querySelector(selector){if(!fields.has(selector))fields.set(selector,{});return fields.get(selector);}
  })
 };
 globalThis.window={addEventListener:event=>events.add(event),removeEventListener:event=>events.delete(event)};
 const message='正在讀取共用廠商品項與當日累計…';
 for(const [receiptGuild,receiptCompact,compact] of [[false,false,false],[true,false,false],[false,true,false],[false,false,true]]){
 const screen=beginProcessing({reading:true,catalogMessage:message,receiptGuild,receiptCompact,compact});
 try{
  assert.equal(dialog.open,true);
  assert.equal(dialog.dataset.compact,(receiptCompact||compact)?'true':undefined);
  assert.ok(dialog.innerHTML.includes(receiptGuild?'herbal-trade.png':'catalog-magnifier.svg'));
  assert.equal(fields.get('.save-banner').textContent,receiptGuild?'補給資料讀取中':'每日耗損資料讀取中');
  assert.equal(fields.get('#save-warning').textContent,(compact||receiptCompact)?'已填數量會保留，不會扣除庫存。':'已填數量會保留');
  assert.equal(fields.get('#save-heading').textContent,(compact||receiptCompact)?'讀取中…':message);
  assert.equal(fields.get('.save-steps').hidden,true);
  assert.equal(events.has('beforeunload'),false);
 }finally{screen.close();}
 assert.equal(isProcessing(),false);
 assert.equal(dialog.removed,true);
 assert.equal(document.body.style.overflow,'auto');
 }
});

test('pending notice shares parchment, stays non-busy and closes before returning to pending controls',t=>{
 const oldDoc=globalThis.document,oldWin=globalThis.window,fields=new Map();let dialog,button,reviewed=false;
 t.after(()=>{globalThis.document=oldDoc;globalThis.window=oldWin;});
 globalThis.document={getElementById:()=>null,head:{append(){}},body:{style:{overflow:'auto'},append(n){dialog=n;}},createElement:()=>({dataset:{},style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(){},showModal(){},close(){},remove(){this.removed=true;},focus(){},querySelector(s){if(!fields.has(s))fields.set(s,{append(n){button=n;}});return fields.get(s);}})};
 globalThis.window={addEventListener(){},removeEventListener(){}};
 const handle=beginProcessing({reading:true,compact:true,notice:true,catalogMessage:'請先查詢同步結果',onReview(){assert.equal(isProcessing(),false);reviewed=true;}});
 try{assert.equal(dialog.dataset.compact,'true');assert.equal(dialog.attrs['aria-busy'],'false');assert.equal(fields.get('.save-dots').hidden,true);assert.equal(fields.get('#save-heading').textContent,'上一筆尚未核對');button.onclick();assert.ok(reviewed);assert.ok(dialog.removed);assert.equal(document.body.style.overflow,'auto');}finally{handle.close();}
});
