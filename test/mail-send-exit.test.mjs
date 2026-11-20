import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=name=>readFileSync(new URL('../web/'+name,import.meta.url),'utf8').replace(/^import[^\n]*$/gm,'').replaceAll(/\bexport /g,'');
const fixture="\nconst dialogs=[],requests=[];let focusCount=0;\nfunction make(tag='node'){let content='';const children=new Map();return {tag,style:{},open:false,isConnected:true,dataset:{},events:{},children,disabled:false,value:'',textContent:'',\n set innerHTML(s){content=s;for(const x of children.values())x.isConnected=false;children.clear();this.button=undefined;},get innerHTML(){return content;},\n querySelector(k){if(!children.has(k))children.set(k,make(k));return children.get(k);},querySelectorAll(){return [];},\n append(x){this.button=x;},insertAdjacentHTML(){},setAttribute(){},addEventListener(k,f){this.events[k]=f;},focus(){focusCount++;},close(){this.open=false;},remove(){this.isConnected=false;},showModal(){this.open=true;}};}\nconst document={createElement:make,createTextNode:text=>({text}),body:{append(d){dialogs.push(d);}}};\nconst google={script:{run:{withSuccessHandler(resolve){return {withFailureHandler(reject){return new Proxy({}, {get(_,method){return arg=>requests.push({method,arg,resolve,reject});}});}};}}}};\nconst globalThis={google},matchMedia=()=>({matches:true}),googleEntryUrl=()=>'/local',chooseOrderOutput=async()=>[],openOrderPdfEditor=({onMail,mergeIds})=>onMail({mergeIds});\nfunction box(){const d=make('box');d.dataset.orderPrint='ERP-A';bindOrderPrint({querySelectorAll(){return [d];}});return d;}\nconst last=method=>requests.filter(x=>x.method===method).at(-1),n=method=>requests.filter(x=>x.method===method).length,dPanel=delivery=>delivery.querySelector('[data-mail-panel]');\nconst staff={staff:[{row:2,name:'QA 僅測試',email:'test@example.invalid',valid:true}]},preview={state:'ready',name:'QA',email:'test@example.invalid',files:[{name:'synthetic.pdf',count:1}],subject:'TEST',mailEnabled:true,token:'SYNTHETIC'};\nasync function pump(){for(let n=0;n<12;n++)await Promise.resolve();}\nasync function open(box,preset=staff){box.querySelector('[data-mail]').onclick();await pump();const loading=dialogs.at(-1),delivery=dialogs.filter(x=>x.innerHTML.includes('data-close-delivery')).at(-1);if(preset){last('erpOrderPdfStaff').resolve(preset);await pump();}return [delivery,loading];}\nasync function showPreview(delivery,reply=preview){const p=dPanel(delivery),select=p.querySelector('[data-recipient]');select.value='2';select.onchange();p.querySelector('[data-preview]').onclick();await pump();last('erpOrderPdfMailPreview').resolve(reply);await pump();return p.querySelector('[data-confirm]').button;}\n";
const sourceInFixture=source('mail-send-gate.mjs')+'\nconst {openMailLoading,openMailProgress}=(()=>{'+source('mail-progress.mjs')+'\nreturn {openMailLoading,openMailProgress};})();\n'+source('order-print.mjs');
const setup=()=>new Function(fixture+'\n'+sourceInFixture+'\nreturn {box,open,pump,n,last,showPreview,dialogs,focus:()=>focusCount,dPanel,preview};')();

test('mail roster can leave a hanging request without stale response stealing the reopened panel',async()=>{
 const y=setup(),a=y.box(),[delivery,loading]=await y.open(a,null),stale=y.last('erpOrderPdfStaff');
 loading.querySelector('[data-leave]').onclick();await y.pump();
 assert.equal(loading.open,false);assert.equal(a.querySelector('[data-mail]').disabled,false);
 assert.equal(y.n('erpOrderPdfMailSend'),0);delivery.close();
 const [reopened]=await y.open(a),before=y.dPanel(reopened).innerHTML;
 stale.reject(Error('stale fixture error'));await y.pump();
 assert.equal(y.dPanel(reopened).innerHTML,before);assert.ok(reopened.open);
});

test('mail preview no longer open cannot furnish a token after late resolve',async()=>{
 const y=setup(),a=y.box(),[delivery]=await y.open(a),panel=y.dPanel(delivery);
 const select=panel.querySelector('[data-recipient]');select.value='2';select.onchange();
 panel.querySelector('[data-preview]').onclick();await y.pump();const stale=y.last('erpOrderPdfMailPreview');
 delivery.close();const [reopened]=await y.open(a),before=y.dPanel(reopened).innerHTML;
 stale.resolve(y.preview);await y.pump();
 assert.equal(y.dPanel(reopened).innerHTML,before);
 assert.equal(y.dPanel(reopened).querySelector('[data-confirm]').button,undefined);
 const fresh=await y.showPreview(reopened);
 assert.ok(fresh);assert.equal(y.n('erpOrderPdfMailSend'),0);
});

test('leaving a send does not cancel or enable duplicates; unknown outcome holds until verified elsewhere',async()=>{
 const y=setup(),a=y.box(),[first]=await y.open(a),send=await y.showPreview(first),b=y.box(),[second]=await y.open(b),stale=await y.showPreview(second);
 send.onclick();await y.pump();assert.equal(y.n('erpOrderPdfMailSend'),1);
 const progress=y.dialogs.at(-1);progress.querySelector('[data-leave]').onclick();await y.pump();
 assert.equal(progress.open,false);assert.equal(first.open,false);
 stale.onclick();await y.pump();assert.equal(y.n('erpOrderPdfMailSend'),1);
 const oldFocus=y.focus();y.last('erpOrderPdfMailSend').resolve({state:'sent',message:'TEST success'});await y.pump();
 assert.equal(y.n('erpOrderPdfMailSend'),1);assert.equal(y.focus(),oldFocus);assert.ok(second.open);
 const [third]=await y.open(y.box()),blocked=await y.showPreview(third,{...y.preview,previousState:'uncertain'});
 assert.equal(blocked,undefined);assert.match(y.dPanel(third).querySelector('[data-confirm]').innerHTML,/目前不可重寄/);
 const [fourth]=await y.open(y.box()),fresh=await y.showPreview(fourth,{...y.preview,previousState:'sent'});
 assert.equal(fresh.textContent,'確認再次寄出訂藥 PDF');
 fresh.onclick();await y.pump();y.dialogs.at(-1).querySelector('[data-leave]').onclick();
 y.last('erpOrderPdfMailSend').reject(Error('fixture transport unknown'));await y.pump();
 y.box().querySelector('[data-mail]').onclick();await y.pump();
 assert.match(y.dialogs.at(-1).querySelector('[role=status]').textContent,/上次寄送結果待確認/);
 assert.equal(y.n('erpOrderPdfMailSend'),2);
});
