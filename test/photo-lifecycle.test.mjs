import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protectDraft,allowLeave} from '../web/page-safety.mjs';
const source=fs.readFileSync(new URL('../web/photo-receive.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function mountPhotoReceive','function mountPhotoReceive');
async function fixture(){
 let detached=false,resolveAuth,rejectAuth,calls=0;
 const elements=new Map();
 const root={querySelector(s){if(detached)return null;if(!elements.has(s))elements.set(s,{innerHTML:'',value:'',files:[],disabled:false,querySelector:()=>null});return elements.get(s)},querySelectorAll(){return []}};
 const context={document:{querySelector:()=>root},window:{addEventListener(){},removeEventListener(){}},localStorage:{getItem:()=>null},loadReceiptCatalog:async()=>({sources:[{brand:'QA'},{brand:'QB'},{brand:'QA'}],rows:[{brand:'QA',id:'1'}]}),quantitySteppers(){},directEnabled:()=>true,authorize:()=>new Promise((resolve,reject)=>{resolveAuth=resolve;rejectAuth=reject}),runDirect(){calls++;throw Error('unexpected external call')},protectDraft,Date,console};
 vm.createContext(context);vm.runInContext(source+'\nthis.mount=mountPhotoReceive;',context);
 const cleanup=context.mount({esc:String,fmt:String,ask(){}});await new Promise(r=>setImmediate(r));
 root.querySelector('#ai-image');root.querySelector('#ai-note');
 return {elements,cleanup,unmount(){cleanup();detached=true},resolveAuth(){resolveAuth()},rejectAuth(){rejectAuth(Error('mock authorization failed'))},calls:()=>calls};
}
test('photo primary buttons have callable handlers',async()=>{const f=await fixture();for(const id of ['#ai-scan','#ai-reload','#ai-add','#ai-preview'])assert.equal(typeof f.elements.get(id).onclick,'function');});
test('late authorization failure after unmount does not reject on removed DOM',async()=>{const f=await fixture();f.elements.get('#ai-image').files=[{type:'image/jpeg',size:1}];const pending=f.elements.get('#ai-scan').onclick();f.unmount();f.rejectAuth();await assert.doesNotReject(pending);assert.equal(f.calls(),0);});
test('late authorization success after unmount stops before image conversion or request',async()=>{const f=await fixture();f.elements.get('#ai-image').files=[{type:'image/jpeg',size:1}];const pending=f.elements.get('#ai-scan').onclick();f.unmount();f.resolveAuth();await assert.doesNotReject(pending);assert.equal(f.calls(),0);});
test('selected photo and note participate in existing navigation confirmation',async()=>{const f=await fixture();assert.equal(f.cleanup.hasUnsavedChanges(),false);f.elements.get('#ai-image').files=[{}];assert.equal(allowLeave(f.cleanup,()=>false),false);assert.equal(allowLeave(f.cleanup,()=>true),true);f.elements.get('#ai-image').files=[];f.elements.get('#ai-note').value='draft';assert.equal(f.cleanup.hasUnsavedChanges(),true);});

test('pasted image participates in navigation confirmation on current multi-row UI',async()=>{const f=await fixture();f.elements.get('#ai-image').onpaste({clipboardData:{files:[{type:'image/png'}]},preventDefault(){}});assert.equal(f.cleanup.hasUnsavedChanges(),true);assert.equal(allowLeave(f.cleanup,()=>false),false);});

test('paste displays explicit ready signal, clears file control, ignores non-image and file change clears pasted draft',async()=>{
 const f=await fixture(),input=f.elements.get('#ai-image');let prevented=0;
 input.value='old-file';input.onpaste({clipboardData:{files:[{type:'text/plain'},{type:'image/png'}]},preventDefault(){prevented++;}});
 const hint=f.elements.get('#ai-image-hint');assert.equal(prevented,1);assert.equal(input.value,'');assert.equal(hint.textContent,'已貼上圖片，可開始辨識。');assert.equal(f.cleanup.hasUnsavedChanges(),true);assert.equal(f.calls(),0);
 input.onchange();assert.equal(hint.textContent,'也可選取此欄位後貼上圖片。');assert.equal(f.cleanup.hasUnsavedChanges(),false);
 input.onpaste({clipboardData:{files:[{type:'text/plain'}]},preventDefault(){assert.fail('not image');}});
 assert.equal(f.cleanup.hasUnsavedChanges(),false);assert.equal(f.calls(),0);
});

test('pasted image reaches authorization gate without a file selection, then unmount prevents OCR',async()=>{
 const f=await fixture();f.elements.get('#ai-image').onpaste({clipboardData:{files:[{type:'image/png',size:1}]},preventDefault(){}});
 const pending=f.elements.get('#ai-scan').onclick();assert.equal(f.elements.get('#ai-status').textContent,'正在壓縮照片、辨識藥名與數量…');
 f.unmount();f.resolveAuth();await assert.doesNotReject(pending);assert.equal(f.calls(),0);
});


test('optional note dropdown reveals other text and preserves edits when switching',async()=>{
 const f=await fixture(),note=f.elements.get('#ai-note');
 note.value='其他';note.onchange();
 assert.equal(f.elements.get('#ai-note-other-field').hidden,false);
 const other=f.elements.get('#ai-note-other')||{value:''};f.elements.set('#ai-note-other',other);other.value='補充內容';
 note.value='換貨補回';note.onchange();assert.equal(f.elements.get('#ai-note-other-field').hidden,true);
 assert.equal(other.value,'補充內容');
 note.value='';note.onchange();assert.equal(f.cleanup.hasUnsavedChanges(),true);
 other.value='';assert.equal(f.cleanup.hasUnsavedChanges(),false);assert.equal(f.calls(),0);
});

test('supplier buttons follow catalog brands, deduplicate and switch selection',async()=>{
 const f=await fixture(),buttons=f.elements.get('#ai-source');
 assert.equal((buttons.innerHTML.match(/data-ai-brand="QA"/g)||[]).length,1);
 assert.match(buttons.innerHTML,/data-ai-brand="QA" aria-pressed="true"/);
 buttons.onclick({target:{closest:()=>({dataset:{aiBrand:'QB'}})}});
 await new Promise(r=>setImmediate(r));
 assert.match(buttons.innerHTML,/data-ai-brand="QB" aria-pressed="true"/);
 assert.match(buttons.innerHTML,/data-ai-brand="QA" aria-pressed="false"/);
 assert.equal(f.calls(),0);
});
