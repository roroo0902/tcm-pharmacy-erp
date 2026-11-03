import test from 'node:test';import assert from 'node:assert/strict';import{beginProcessing,isProcessing}from '../web/processing-screen.mjs';
test('processing blocks Escape/unload and restores the page after success or failure',t=>{
 const oldDoc=globalThis.document,oldWin=globalThis.window;const nodes=[],events=new Map();let focus=0;
 t.after(()=>{globalThis.document=oldDoc;globalThis.window=oldWin;});
 const detail={textContent:''},write={classList:{add(v){this.value=v;}}};
 globalThis.document={activeElement:{isConnected:true,focus(){focus++;}},getElementById:()=>null,head:{append(){}},body:{append(e){nodes.push(e);}},createElement:tag=>({dataset:{},attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.events[k]=v;},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;},querySelector:s=>s==='.step-write'?write:detail})};
 globalThis.window={addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)};
 for(let i=0;i<2;i++){const screen=beginProcessing(),dialog=nodes.at(-1);assert.equal(isProcessing(),true);assert.throws(()=>beginProcessing(),/仍在入帳/);let cancelled=false;dialog.events.cancel({preventDefault(){cancelled=true;}});assert.ok(cancelled);assert.ok(dialog.open);const event={preventDefault(){this.prevented=true;}};events.get('beforeunload')(event);assert.ok(event.prevented);screen.readback();assert.equal(dialog.dataset.stage,'readback');screen.close();screen.close();assert.equal(isProcessing(),false);assert.equal(events.size,0);assert.ok(dialog.removed);}assert.equal(focus,2);
});
