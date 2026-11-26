import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMailSendGate} from '../web/mail-send-gate.mjs';
import {prepareOrderOutputDraft} from '../web/order-output-draft.mjs';
import {orderScrollStyle} from '../web/order-scroll-style.mjs';
const source=readFileSync(new URL('../web/order-pdf-editor.mjs',import.meta.url),'utf8')
 .replace(/^import[^\n]*$/gm,'').replace(/^export /gm,'');
const result=(id='QA-order')=>({id,sheets:[{title:'合成科達',count:1,url:'http://127.0.0.1:1111/#orders'}],message:'合成列印已讀回'});
const tick=()=>new Promise(setImmediate);

function fixture(){
 let dialogs=[],calls=[],store=new Map();
 const node=(tag='')=>{
  let text='',html='',children=new Map();
  const self={tag,style:{},open:false,attached:true,events:{},disabled:false,
   get textContent(){return text;},set textContent(data){text=data;},get innerHTML(){return html;},set innerHTML(data){html=data;children=new Map();},
   querySelector(s){if(!children.has(s))children.set(s,node(s));return children.get(s);},
   querySelectorAll(s){return s==='button'?['[data-back]','[data-generate]'].map(k=>self.querySelector(k)):[];},
   addEventListener(name,fn){this.events[name]=fn;},showModal(){this.open=true;},remove(){this.attached=false;},
   close(){this.open=false;this.events.close?.();}
  };return self;
 };
 const document={createElement:node,body:{append:d=>dialogs.push(d)}};
 const rpc=async (operation,input)=>{
  if(operation==='erpOrderPdfEditSource')return {id:input.id,date:'2026-11-20',actor:'QA',brands:['科達'],sourceHash:'fixture',rows:[{brand:'科達',category:'單方',name:'合成',quantity:1,manual:false}]};
  if(operation==='erpOrderPdfDraftPreview')return {groups:[{brand:'科達',items:[{brand:'科達',category:'單方',name:'合成',quantity:1}]}]};
  assert.equal(operation,'erpPrintConfirmedOrder');
  return new Promise((resolve,reject)=>calls.push({input,resolve,reject}));
 };
 const open=new Function('document','localStorage','createMailSendGate','prepareOrderOutputDraft','orderScrollStyle',source+'\nreturn openOrderPdfEditor;')(document,{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)},createMailSendGate,prepareOrderOutputDraft,orderScrollStyle);
 async function editor(id='QA-order',mergeIds=[]){
  await open({id,mergeIds,rpc,output:'print'});const dialog=dialogs.at(-1),body=dialog.querySelector('[data-body]'),status=dialog.querySelector('[role=status]');
  await body.querySelector('[data-stage]').querySelector('[data-review]').onclick();
  const stage=body.querySelector('[data-stage]');
  return {dialog,status,close:dialog.querySelector('[data-close]'),generate:stage.querySelector('[data-generate]'),link:stage.querySelector('.pdf-output')};
 }
 return {editor,dialogs,calls};
}

test('pending print can leave; no late UI change and no duplicate while a shared print write is unresolved',async()=>{
 const h=fixture(),first=await h.editor(),old=first.generate.onclick(); await tick();
 assert.equal(h.calls.length,1);
 assert.match(first.close.textContent,/不取消列印/);
 assert.match(first.status.textContent,/正在產生列印版/);
 const oldStatus=first.status.textContent;let prevented=false;
 first.dialog.events.cancel({preventDefault(){prevented=true;}});
 assert.equal(prevented,false); first.close.onclick();
 assert.equal(first.dialog.open,false);
 const a=await h.editor('QA-other',['QA-order']);
 a.generate.onclick();await tick();
 assert.equal(h.calls.length,1);assert.match(a.status.textContent,/列印版正在產生/);
 const unrelated=await h.editor('QA-unrelated');unrelated.generate.onclick();await tick();
 assert.equal(h.calls.length,1);assert.match(unrelated.status.textContent,/列印版正在產生/);
 h.calls[0].resolve(result());await old;
 assert.equal(first.dialog.open,false);
 assert.equal(first.status.textContent,oldStatus);
 assert.equal(first.link.innerHTML,'');
 a.generate.onclick();await tick();
 assert.equal(h.calls.length,1);assert.match(a.status.textContent,/重新核對/);
 const b=await h.editor('QA-other',['QA-order']),fresh=b.generate.onclick();await tick();
 assert.equal(h.calls.length,2);
 h.calls[1].resolve(result('QA-other'));await fresh;
 assert.match(b.link.innerHTML,/開啟 合成科達/);
 assert.match(b.status.textContent,/合成列印已讀回/);
 assert.equal(b.generate.disabled,true);
});

test('unknown print result blocks fresh and merged same-order attempts without starting another write',async()=>{
 for(const mode of ['rejection','wrong-id','empty-result']){
  const h=fixture(),first=await h.editor(),req=first.generate.onclick();await tick();
  if(mode==='rejection')h.calls[0].reject(Error('fixture connection lost'));
  else if(mode==='wrong-id')h.calls[0].resolve(result('QA-wrong'));
  else h.calls[0].resolve({id:'QA-order',sheets:[]});
  await req;
  assert.match(first.status.textContent,/結果待核對.*不要重複/);
  assert.equal(first.link.innerHTML,'');
  first.close.onclick();assert.equal(first.dialog.open,false);
  const next=await h.editor('QA-another',['QA-order']);next.generate.onclick();await tick();
  assert.match(next.status.textContent,/待核對/);assert.equal(h.calls.length,1);
  const disjoint=await h.editor('QA-disjoint');disjoint.generate.onclick();await tick();
  assert.match(disjoint.status.textContent,/待核對/);assert.equal(h.calls.length,1);
 }
});

test('preview opened before another write must be reviewed anew even after that write is verified',async()=>{
 const h=fixture(),stale=await h.editor(),printing=await h.editor(),work=printing.generate.onclick();await tick();
 assert.equal(h.calls.length,1);
 h.calls[0].resolve(result());await work;
 stale.generate.onclick();await tick();
 assert.equal(h.calls.length,1);assert.match(stale.status.textContent,/重新核對/);
});

test('catalog additions merge at preview time and removing them preserves original quantities',()=>{
 const original={key:'科達單方|A1004',brand:'科達',category:'單方',code:'A1004',name:'大黃',quantity:60,manual:false};
 const extra={...original,catalog:true,quantity:'2'};
 const rows=[original,extra];
 const draft=()=>prepareOrderOutputDraft({rows:structuredClone(rows)},{rows:[original]});
 assert.equal(draft().rows[0].quantity,62);
 extra.quantity='3';assert.equal(draft().rows[0].quantity,63);
 rows.pop();assert.equal(draft().rows[0].quantity,60);
 rows.push({...extra,category:'複方',code:'B1109',name:'甘麥大棗湯'});
 assert.match(draft().rows[1].name,/甘麥大棗湯.*B1109/);
});
