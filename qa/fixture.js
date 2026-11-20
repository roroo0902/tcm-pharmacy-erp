// Sandbox-only Apps Script emulator. State resets per browser context.
(()=>{
 const item={sheet:'科達單方',code:'QA20261120A',name:'ERP驗收專用・非藥品'};
 const normal={sheet:item.sheet,code:'NORMAL-001',name:'合成普通品項'};
 const id='SH-12345678-1234-1234-1234-123456789abc';
 const rec={id,...item,revision:0,need:10,threshold:2,status:'pending',supply:'unknown',priority:'normal',eta:'',note:'synthetic',actor:'QA 操作員'};
 const tab={name:item.sheet,brand:'科達',category:'單方',gid:1};
 const controls={failPlanning:false,failShortage:false,shortageMode:'zero'};
 const requests=[];
 const transactions=new Map();
 const stock=new Map([[item.code,4],[normal.code,4]]);
 const posted=new Map([[item.code,2],[normal.code,2]]);
 const days=['日','一','二','三','四','五','六'];
 function grid(date){
  const h=Array(14).fill(''),d=[...h];
  h[1]='編號';h[3]='藥品名稱';h[4]='價格';h[13]=date;
  d[6]='未拆封';d[13]=days[new Date(date+'T00:00:00Z').getUTCDay()];
  return [h,d,...[item,normal].map(x=>{
   const r=Array(14).fill('');r[1]=x.code;r[3]=x.name;r[6]=String(stock.get(x.code));r[13]='2';return r;
  })];
 }
 const tx=(id,action,quantity)=>({draft:{id,action,lines:[{...item,quantity}]}});
 const allocation=(kind,transactionId,quantity)=>({shortageId:id,kind,transactionId,sheet:item.sheet,code:item.code,quantity});
 const shortage=()=>{
  if(controls.failShortage)throw Error('fixture shortage offline');
  if(controls.shortageMode==='zero')return {records:[],substitutions:[],events:[],orders:[],receipts:[]};
  const order=tx('ERP-qa-ordered','訂貨',6),received=tx('ERP-qa-received','進貨',2);
  const additions=[...transactions.values()].map(x=>x.draft).filter(x=>x.kind==='tcm-cloud'&&x.action==='進貨'&&x.shortageLinks?.length);
  const other=controls.shortageMode==='many'?Array.from({length:33},(_,i)=>({...rec,id:'SH-22345678-1234-1234-1234-12345678'+String(i).padStart(4,'0'),code:'Q-'+i,name:'合成項 '+i})):[];
  return {records:[rec,...other],substitutions:[],orders:[order],receipts:[received,...additions.map(draft=>({draft}))],events:[{allocation:allocation('order',order.draft.id,6)},{allocation:allocation('receipt',received.draft.id,2)}]};
 };
 const catalog=date=>({sources:[tab],sheets:{[tab.name]:grid(date)}});
 function preview(d){
  const token=JSON.stringify(d);
  if(d.kind==='tcm-cloud'&&d.action==='進貨'){
   const lines=d.lines.map(l=>{
    const link=d.shortageLinks?.find(a=>a.sheet===l.sheet&&a.code===l.code);
    if(link&&(link.quantity>l.quantity||link.quantity>4))throw Error('fixture invalid receipt link');
    const before=stock.get(l.code);
    return {...l,before,after:before+l.quantity,...(l.unitPriceCents===undefined?{}:{amountCents:l.unitPriceCents*l.quantity})};
   });
   return {token,lines,duplicate:transactions.has(d.id)};
  }
  if(d.kind==='tcm-loss-cumulative'){
   return {token,lines:d.lines.map(l=>({...l,before:posted.get(l.code),delta:l.total-posted.get(l.code),stockAfter:stock.get(l.code)-(l.total-posted.get(l.code))}))};
  }
  throw Error('fixture does not preview this transaction');
 }
 function rpc(op,arg,token){
  requests.push({op,arg:arg?structuredClone(arg):null});
  if(op==='readStaff')return {names:['QA 操作員']};
  if(op==='readOrderCatalog')return catalog('2026-01-19');
  if(op==='readLossPlanning'){
   if(controls.failPlanning)throw Error('fixture planning offline');
   return {values:grid(arg.start)};
  }
  if(op==='readShortage')return shortage();
  if(op==='readDailyLossGrid'||op==='readLossCatalog')return {...catalog(arg.date),date:arg.date,readAt:'fixture',loss:[item,normal].map((x,i)=>({...x,row:i+3,stock:stock.get(x.code),posted:posted.get(x.code)}))};
  if(op==='readLossDay')return {};
  if(op==='prepareLoss')return {};
  if(op==='preview')return preview(arg);
  if(op==='commit'){
   if(token!==JSON.stringify(arg))throw Error('fixture preview token mismatch');
   const id=arg.id||'loss:'+token;
   if(transactions.has(id))return transactions.get(id).result;
   const result={...preview(arg),id,message:'fixture local commit only'};
   for(const line of result.lines){
    stock.set(line.code,line.after??line.stockAfter);
    if(arg.kind==='tcm-loss-cumulative')posted.set(line.code,line.total);
   }
   transactions.set(id,{draft:structuredClone(arg),result});return result;
  }
  throw Error('fixture unknown RPC: '+op);
 }
 Object.defineProperty(window,'__qa',{value:{controls,requests,stock,posted},writable:false});
 let qaStatus;
 function refreshControls(){
  if(!qaStatus)return;
  qaStatus.textContent='訂藥：'+(controls.failPlanning?'模擬失敗':'正常')+'；缺藥：'+(controls.failShortage?'模擬失敗':controls.shortageMode)+'；QA 庫存 '+stock.get(item.code)+'；已入帳耗損 '+posted.get(item.code)+'；預覽 '+requests.filter(r=>r.op==='preview').length+' 次；僅記憶體確認 '+requests.filter(r=>r.op==='commit').length+' 次';
 }
 function fixtureControls(){
  const panel=document.createElement('section');
  panel.id='qa-fixture';panel.className='panel';
  const title=document.createElement('h2');title.textContent='隔離驗收控制｜不連正式 Google';
  panel.append(title);
  for(const [label,action] of [
   ['訂藥：下次讀取失敗',()=>{controls.failPlanning=true;}],
   ['訂藥：恢復讀取',()=>{controls.failPlanning=false;}],
   ['缺藥：成功 0 項',()=>{controls.shortageMode='zero';controls.failShortage=false;}],
   ['缺藥：讀取失敗',()=>{controls.failShortage=true;}],
   ['缺藥：成功 34 項',()=>{controls.shortageMode='many';controls.failShortage=false;}],
   ['缺藥：單筆待到 4',()=>{controls.shortageMode='linked';controls.failShortage=false;}],
  ]){
   const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;
   b.onclick=()=>{action();refreshControls();};panel.append(b);
  }
  qaStatus=document.createElement('p');qaStatus.setAttribute('role','status');panel.append(qaStatus);
  document.querySelector('main').prepend(panel);refreshControls();
  document.addEventListener('click',e=>{
   const target=e.target.closest?.('a[href]');if(target&&new URL(target.href,location.href).origin!==location.origin){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  window.open=()=>null;
 }
 fixtureControls();
 const run={withSuccessHandler:ok=>({withFailureHandler:fail=>({
  erpHosted(op,arg,token){setTimeout(()=>{try{ok(structuredClone(rpc(op,arg,token)));}catch(e){fail({message:e.message});}finally{refreshControls();}},op==='readShortage'||op==='readLossPlanning'?500:5);}
 })})};
 Object.defineProperty(window,'google',{value:{script:{run}},writable:false});
})();
