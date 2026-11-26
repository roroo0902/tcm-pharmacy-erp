import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountShortage} from '../web/shortage.mjs';

test('substitutions distinguish loading, empty, filtered, populated and failed reads', async()=>{
 const original={document:globalThis.document,localStorage:globalThis.localStorage,google:globalThis.google};
 const nodes=new Map();
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{style:{},dataset:{}});
  return nodes.get(id);
 };
 const tabs=['records','substitutions'].map(tab=>({dataset:{tab}}));
 const content={querySelector:id=>id==='#sh-retry'?null:node(id),querySelectorAll:key=>key==='[data-tab]'?tabs:[]};
 const cardText=()=>Object.fromEntries(Array.from(
  content.innerHTML.matchAll(/<button\b[^>]*\bdata-filter="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g),
  ([,filter,body])=>[filter,body.replace(/<[^>]+>/g,'').replace(/\s+/g,'')]
 ));
 const expectCardValues=value=>assert.deepEqual(cardText(),{
  pending:'待確認缺藥'+value,low:'低庫存待補'+value,arrival:'已訂待到貨'+value,unavailable:'廠商缺貨'+value
 });
 const empty={records:[],substitutions:[],events:[],orders:[],receipts:[]};
 let next=empty;
 globalThis.document={querySelector:()=>content};
 globalThis.localStorage={getItem:()=>null};
 globalThis.google={script:{run:{
  withSuccessHandler(ok){return {withFailureHandler(fail){return {
   erpHosted(action){
    if(action==='readOrderCatalog')return ok({sources:[{name:'QA',brand:'QA',category:'單方',gid:1}],sheets:{QA:[['','編號','','藥品名稱'],['','','','','','','未拆封']]}});
    if(action==='readShortage')return next instanceof Error?fail(next):ok(next);
    return fail(Error('Unexpected action: '+action));
   }
  };}};}
 }}};
 try{
  const close=mountShortage({esc:s=>String(s??''),ask:()=>{throw Error('unexpected dialog');}});
  assert.equal((content.innerHTML.match(/data-filter="[^"]+" disabled>/g)||[]).length,4);
  expectCardValues('待讀取');
  tabs[1].onclick();
  assert.match(node('#sh-list').innerHTML,/正在讀取/);
  await new Promise(setImmediate);
  assert.match(node('#sh-list').innerHTML,/尚無替代設定/);
  next={...empty,substitutions:[{id:'qa',from:{name:'QA-A'},to:{name:'QA-B'},priority:1,status:'pending',note:'QA'}]};
  await node('#sh-reload').onclick();
  assert.match(node('#sh-list').innerHTML,/QA-A → QA-B/);
  node('#sh-search').oninput({target:{value:'none'}});
  assert.match(node('#sh-list').innerHTML,/沒有符合條件/);
  next=Error('fixture offline');
  await node('#sh-reload').onclick();
  assert.match(node('#sh-list').innerHTML,/讀取失敗.*fixture offline/);
  assert.doesNotMatch(node('#sh-list').innerHTML,/尚無替代設定/);
  assert.equal(node('#sh-new').disabled,true);
  assert.equal(node('#sh-reload').disabled,false);
  tabs[0].onclick();
  expectCardValues('無法取得');
  next=empty;
  const reload=node('#sh-reload').onclick();
  expectCardValues('待讀取');
  await reload;
  expectCardValues('0項');
  assert.doesNotMatch(content.innerHTML,/data-filter="[^"]+" disabled>/);
  next={...empty,records:[{id:'SH-12345678-1234-1234-1234-123456789abc',sheet:'QA',code:'QA-A',name:'QA 品項',revision:0,need:1,threshold:0,priority:'normal',status:'pending',supply:'unknown',eta:'',note:'',actor:'QA'}]};
  await node('#sh-reload').onclick();
  assert.equal(cardText().pending,'待確認缺藥1項');
  close();
 }finally{Object.assign(globalThis,original);}
});
