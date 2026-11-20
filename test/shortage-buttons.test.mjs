import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mountShortage} from '../web/shortage.mjs';

const item={sheet:'科達單方',code:'A1085',name:'合成甲'};
const record={...item,id:'SH-12345678-1234-1234-1234-123456789abc',revision:0,need:2,threshold:0,priority:'normal',status:'confirmed',supply:'unknown',eta:'',note:'',actor:'QA'};
const other={...item,code:'B1085',name:'合成乙'},sameName={...item,code:'A0000'};
const keys={handoff:'tcm-shortage-handoff-v1'};
const state={
 records:[record],
 substitutions:[[item,other,'FORWARD'],[other,item,'INVERSE'],[sameName,other,'WRONG CODE']].map(([from,to,note],i)=>({id:'SU-'+i,from,to,note,priority:1,status:'pending'})),
 events:[{allocation:{shortageId:record.id,kind:'order',transactionId:'ERP-order123',sheet:item.sheet,code:item.code,quantity:1}}],
 orders:[{draft:{id:'ERP-order123',action:'訂貨',lines:[{...item,quantity:1}]}}],
 receipts:[]
};
async function fixture(body) {
 const names=['document','localStorage','sessionStorage','location','google'];
 const original=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const nodes=new Map(),session=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},dataset:{}});return nodes.get(id);};
 const tabs=['records','substitutions'].map(tab=>({dataset:{tab}}));
 const buttons=Object.fromEntries(['order','receive','alternatives'].map(k=>[k,{getAttribute:()=>record.id,dataset:{[k]:record.id}}]));
 const content={
  querySelector:id=>id==='#sh-retry'?null:node(id),
  querySelectorAll:k=>k==='[data-tab]'?tabs:buttons[k.slice(6,-1)]?[buttons[k.slice(6,-1)]]:[]
 };
 const mocked={
  document:{querySelector:()=>content},localStorage:{getItem:()=>null},
  sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v)},
  location:{hash:'shortage'},
  google:{script:{run:{
   withSuccessHandler:ok=>({withFailureHandler:fail=>({erpHosted:action=>{
    if(action==='readOrderCatalog')return ok({sources:[{name:item.sheet,brand:'科達',category:'單方',gid:1}],sheets:{[item.sheet]:[['','編號','','藥品名稱'],['','','','','','','未拆封']]}});
    if(action==='readShortage')return ok(state);
    return fail(Error('Unexpected RPC '+action));
   }})})
  }}}
 };
 for(const [k,value] of Object.entries(mocked))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value});
 let close;
 try{
  close=mountShortage({esc:s=>String(s??''),ask:()=>{throw Error('unexpected dialog');}});
  await new Promise(setImmediate);
  await body({node,tabs,buttons,session,location:mocked.location});
 }finally{
  close?.();
  for(const [k,d] of Object.entries(original))d?Object.defineProperty(globalThis,k,d):delete globalThis[k];
 }
}

test('row order and receipt handoffs preserve other drafts and show guidance',()=>fixture(({node,buttons,session,location})=>{
 for(const [action,kind,dest] of [['order','receive','orders'],['receive','order','receive']]){
  const before=JSON.stringify({action:kind,records:[]});session.set(keys.handoff,before);
  assert.doesNotThrow(()=>buttons[action].onclick());
  assert.match(node('#sh-state').textContent,/尚有其他類型草稿/);
  assert.equal(location.hash,'shortage');
  assert.equal(session.get(keys.handoff),before);
  session.delete(keys.handoff);
  buttons[action].onclick();
  assert.equal(location.hash,dest);
  const queued=JSON.parse(session.get(keys.handoff));
  assert.equal(queued.action,action);
  assert.deepEqual(queued.records,[{...item,id:record.id,quantity:1}]);
  location.hash='shortage';
 }
}));

test('row alternatives scope to exact source item; search and tab restore general browsing',()=>fixture(({node,buttons,tabs})=>{
 const list=node('#sh-list');
 buttons.alternatives.onclick();
 assert.match(list.innerHTML,/查看此缺藥品項的替代設定.*A1085/);
 assert.match(list.innerHTML,/FORWARD/);
 assert.doesNotMatch(list.innerHTML,/INVERSE|WRONG CODE/);
 node('#sh-search').oninput({target:{value:item.name}});
 assert.doesNotMatch(list.innerHTML,/查看此缺藥品項的替代設定/);
 for(const text of ['FORWARD','INVERSE','WRONG CODE'])assert.ok(list.innerHTML.includes(text),text);
 tabs[0].onclick();buttons.alternatives.onclick();tabs[1].onclick();
 assert.doesNotMatch(list.innerHTML,/查看此缺藥品項的替代設定/);
 assert.match(list.innerHTML,/INVERSE/);
}));
