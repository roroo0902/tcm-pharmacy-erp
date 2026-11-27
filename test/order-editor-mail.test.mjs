import test from 'node:test';
import assert from 'node:assert/strict';
import {sendEditorOrder} from '../web/order-editor-mail.mjs';
import {createMailSendGate} from '../web/mail-send-gate.mjs';

function setup(overrides={}){
 const recipient={row:2,name:'收件員工',email:'staff@example.invalid'};
 const draft={rows:[{brand:'科達',quantity:2}],mergeIds:['previous']};
 const preview={state:'ready',...recipient,mailEnabled:true,files:[],token:'preview',...overrides};
 const calls=[];
 const options={id:'order',recipient,draft,gate:createMailSendGate(),isOpen:()=>true,status(){},
  rpc:async(method,arg)=>{calls.push({method,arg});return method==='erpOrderPdfMailPreview'?preview:{state:'sent'};}};
 return {options,calls};
}
test('only a visible editor with the reviewed staff identity and fresh mail state can send',async()=>{
 for(const changes of [{email:'other@example.invalid'},{name:'其他員工'},{row:3},{previousState:'sent'},{previousState:'uncertain'},{previousState:'sending'},{mailEnabled:false},{token:''}]){
  const {options,calls}=setup(changes);
  await assert.rejects(sendEditorOrder(options));
  assert.deepEqual(calls.map(c=>c.method),['erpOrderPdfMailPreview']);
 }
 const {options,calls}=setup();
 options.isOpen=()=>false;
 await sendEditorOrder(options);
 assert.equal(calls.length,1);
});
test('a pending direct send blocks a second click on the same or merged order',async()=>{
 const {options,calls}=setup();
 let resolve;
 options.rpc=(method,arg)=>{calls.push({method,arg});return new Promise(r=>resolve=r);};
 const first=sendEditorOrder(options);
 await assert.rejects(sendEditorOrder({...options,id:'previous',draft:{mergeIds:[]}}));
 assert.deepEqual(calls,[{method:'erpOrderPdfMailPreview',arg:{id:'order',draft:options.draft,row:2,test:false}}]);
 resolve({state:'ready',previousState:'sent',...options.recipient});
 await assert.rejects(first);
});
