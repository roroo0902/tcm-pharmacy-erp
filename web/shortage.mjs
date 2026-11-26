import {isOperationalOrderQa} from '../src/orders.mjs?v=release20261120r1';
import {substitutionPicker,mountSubstitutionPicker} from './substitution-picker.mjs';
import {runDirect,authorize,directReview} from './direct-sync.mjs?v=release20261120r1';
import {loadSupplierCatalog} from './supplier-catalog.mjs?v=googlesync20261114';
import {shortageProgress,normalizeShortage,normalizeSubstitution} from '../src/shortage.mjs?v=release20261120r1';
import {queueShortage} from './shortage-handoff.mjs?v=release20261120r1';
import {shortageStyle} from './shortage-style.mjs?v=shortageCards2';
export function mountShortage({esc,ask}){
 const c=document.querySelector('#content');let alive=true,busy=false,readState='loading',readError='',state={records:[],substitutions:[],events:[],orders:[],receipts:[]},rows=[],tab='records',filter='',query='',brand='',category='',alternativeSource=null,returnFilters=null;const selectedIds=new Set();
 const labels={pending:'待確認缺藥',confirmed:'已確認缺藥',sufficient:'開封中足夠',closed:'已結案',cancelled:'取消補貨',deferred:'暫不補貨',unknown:'待回覆',available:'可供貨',unavailable:'廠商缺貨'};
 const key=r=>r.sheet+'|'+r.code,allocations=()=>state.events.filter(e=>e.allocation).map(e=>e.allocation),progress=r=>state.progress?.[r.id]??shortageProgress(r,allocations(),state.orders,state.receipts);
 const status=t=>{const e=c.querySelector('#sh-state');if(e)e.textContent=t;};
 const itemOptions=(value='')=>rows.filter(r=>r.code&&!r.warning?.includes('編號')).map(r=>`<option value="${esc(r.name+'|'+r.code)}" ${value===r.name+'|'+r.code?'selected':''}>${esc(r.brand+' '+r.category+' · '+r.code+' '+r.drug)}（${r.bottles??'待核對'}瓶）</option>`).join('');
 const item=k=>{const r=rows.find(r=>r.name+'|'+r.code===k);if(!r)throw Error('請選擇有效品項');return {sheet:r.name,code:r.code,name:r.drug};};
 async function load({fresh=false}={}){
  if(busy)return;busy=true;readState='loading';draw();
  try{
   await authorize();const result=await Promise.all([runDirect('readShortage',{view:'summary'}),loadSupplierCatalog({fresh})]);if(!alive)return;
   state=result[0];rows=result[1].rows;readState='ready';
  }catch(e){readState='error';readError=e.message;}finally{busy=false;}
  if(alive){draw();if(readState==='ready')status('已讀回 Google 工作表 · '+new Date().toLocaleTimeString('zh-TW'));}
 }
 async function save(kind,value,actor,retry=false){if(busy)return;if(!retry){try{if(kind==='record')value=normalizeShortage(value);if(kind==='substitution')value=normalizeSubstitution(value);}catch(e){status(e.message);return;}}const pendingKey='tcm-shortage-pending-v1';const old=JSON.parse(localStorage.getItem(pendingKey)||'null');if(old&&!retry){status('有一筆儲存結果待確認，請先按「重試待確認儲存」');return;}busy=true;const request=old||{operationId:'SE-'+crypto.randomUUID(),kind,value,...(actor?{actor}:{})};localStorage.setItem(pendingKey,JSON.stringify(request));try{status('正在儲存並讀回…');await runDirect('saveShortage',request);const check=await runDirect('readShortage');if(!check.events.some(e=>e.operationId===request.operationId))throw Error('尚未讀回此操作，請重新整理核對');localStorage.removeItem(pendingKey);state=check;draw();status('已儲存並讀回確認');}catch(e){if(/其他人已更新|此藥品已有|替代關係已存在|關聯數量超過|原交易已取消|找不到唯一|名稱不符|藥品編號或名稱已變動/.test(e.message))localStorage.removeItem(pendingKey);draw();status(e.message+'；請重新讀取核對，或重試同一筆待確認儲存');}finally{busy=false;}}
 const field=(name,label,value='',type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
 const select=(name,label,options,value)=>`<label>${label}<select name="${name}">${options.map(([v,t])=>`<option value="${v}" ${v===value?'selected':''}>${t}</option>`).join('')}</select></label>`;
 const actor=()=>'<label>經手人<select name="actor" data-staff required><option value="">請選擇經手人</option></select></label>';
 function edit(record,initial){const r=record||{id:'SH-'+crypto.randomUUID(),revision:0,status:'pending',supply:'unknown',need:0,threshold:0,priority:'normal'};ask(`<form id="shortage-edit"><h3>${initial?'核對開封量':record?'更新缺藥追蹤':'登記缺藥'}</h3><div class="grid">${record?'<label>藥品<select name="item" disabled>'+itemOptions(key(record))+'</select></label>':substitutionPicker('item','缺藥品項',esc)}${actor()}${field('need','待補需求（瓶）',r.need,'number','min="0" max="1000000" step="1" required')}${field('threshold','低庫存門檻（瓶）',r.threshold,'number','min="0" max="1000000" step="1" required')}${select('status','開封量與缺藥狀態',Object.entries(labels).filter(([k])=>['pending','confirmed','sufficient','closed','cancelled','deferred'].includes(k)),r.status)}${select('supply','廠商供貨',Object.entries(labels).filter(([k])=>['unknown','available','unavailable'].includes(k)),r.supply)}${select('priority','處理優先順序',[['urgent','優先'],['normal','一般']],r.priority)}${field('eta','預計到貨日',r.eta||'','date')}<label class="full">條件與備註（結案／取消／暫緩請填原因）<textarea name="note" maxlength="1000">${esc(r.note||'')}</textarea></label></div></form>`,()=>{const f=new FormData(document.querySelector('#shortage-edit'));save('record',{...r,...(record?{}:item(f.get('item'))),actor:f.get('actor'),need:Number(f.get('need')),threshold:Number(f.get('threshold')),priority:f.get('priority'),status:f.get('status'),supply:f.get('supply'),eta:f.get('eta'),note:f.get('note')});},'儲存追蹤');if(!record)mountSubstitutionPicker(document.querySelector('#shortage-edit [data-picker="item"]'),rows,initial,esc);}
 function substitute(r){r=r||{id:'SU-'+crypto.randomUUID(),revision:0,priority:1,status:'pending'};ask(`<form id="sub-edit"><h3>缺藥替代設定</h3><img class="shortage-alchemist" src="./web/assets/shortage-alchemist-pixel.png" alt="鍊金術師調配藥劑插圖"><div class="grid">${substitutionPicker('from','缺藥品項',esc)}${substitutionPicker('to','替代候選',esc)}${actor()}${select('status','確認狀態',[['pending','待專業確認'],['confirmed','已確認'],['disabled','停用']],r.status)}${field('priority','候選順序',r.priority,'number','min="1" max="100" required')}<label class="full">適用條件、限制與備註<textarea name="note" maxlength="1000">${esc(r.note||'')}</textarea></label></div><p>此候選僅供人工核對，由缺藥品項指向替代候選；處方與劑量由專業人員確認。</p></form>`,()=>{const f=new FormData(document.querySelector('#sub-edit'));save('substitution',{...r,from:item(f.get('from')),to:item(f.get('to')),priority:Number(f.get('priority')),status:f.get('status'),note:f.get('note'),actor:f.get('actor')});},'儲存替代設定');const form=document.querySelector('#sub-edit');for(const side of ['from','to'])mountSubstitutionPicker(form.querySelector('[data-picker="'+side+'"]'),rows,r[side],esc);}
 // Legacy deployments return full details even when a summary is requested.
 // Only history and manual allocation need the full transaction list.
 async function showDetail(record,show){
  if(busy)return;
  if(!state.progress){show(record,state);return;}
  busy=true;status('正在讀取追蹤明細…');
  try{
   const detail=await runDirect('readShortage');
   if(alive){status('');show(record,detail);}
  }catch(error){if(alive)status('明細讀取失敗：'+error.message+'。請再試一次。');}
  finally{busy=false;}
 }
 function link(r,kind,detail){const events=kind==='order'?detail.orders:detail.receipts,action=kind==='order'?'訂貨':'進貨',reversed=new Set(events.map(e=>e.draft?.reverses));const choices=events.filter(e=>e.draft?.action===action&&!reversed.has(e.draft.id)&&e.draft.lines.some(l=>l.sheet===r.sheet&&l.code===r.code));ask(`<form id="allocation-edit"><h3>關聯已確認${action}紀錄</h3><p>只關聯已入帳的交易，不會再次變更庫存。請確認這筆數量屬於本次補貨。</p><label>交易<select name="transactionId" required><option value="">請選擇</option>${choices.map(e=>`<option value="${esc(e.draft.id)}">${esc(e.draft.date+' '+e.draft.actor+' '+e.draft.id+' · '+e.draft.lines.find(l=>l.sheet===r.sheet&&l.code===r.code).quantity+'瓶')}</option>`).join('')}</select></label>${field('quantity','本次關聯瓶數','','number','min="1" max="1000000" required')}${actor()}</form>`,()=>{const f=new FormData(document.querySelector('#allocation-edit'));save('allocation',{shortageId:r.id,kind,transactionId:f.get('transactionId'),sheet:r.sheet,code:r.code,quantity:Number(f.get('quantity'))},f.get('actor'));},'確認關聯');}
 function history(r,detail){const logs=detail.events.filter(e=>e.targetId===r.id);ask(`<h3>追蹤歷程</h3>${logs.map(e=>`<p>${esc(e.time)} · ${esc(e.actor)} · ${esc(e.kind==='allocation'?'關聯交易': '更新設定')}</p><details><summary>內容</summary><pre style="white-space:pre-wrap">${esc(e.request)}</pre></details>`).join('')||'<p>尚無紀錄</p>'}`,()=>{},'關閉');}
 const closedSections=new Set();
 const metricNames={pending:'待確認缺藥',low:'低庫存待補',arrival:'已訂待到貨',unavailable:'廠商缺貨'};
 function draw(){
  if(!alive)return;
  const catalog=new Map(rows.map(row=>[row.name+'|'+row.code,row]));
  const records=state.records.map(record=>({
   record,row:catalog.get(key(record)),p:progress(record),
   open:!['closed','cancelled'].includes(record.status)
  }));
  const openKeys=new Set(records.filter(x=>x.open).map(x=>key(x.record)));
  const implicit=rows.filter(row=>row.bottles===0&&row.code&&!openKeys.has(row.name+'|'+row.code));
  const includesMetric=(entry,k)=>{
   if(!entry.open)return false;
   const {record:r,row,p}=entry;
   if(k==='pending')return r.status==='pending';
   if(k==='low')return row?.bottles!=null&&row.bottles<r.threshold;
   if(k==='arrival')return p.outstanding>0;
   return r.supply==='unavailable';
  };
  const recordTab=tab==='records',ready=readState==='ready';
  const card=(k,title)=>{
   const count=records.filter(x=>includesMetric(x,k)).length+(k==='pending'?implicit.length:0);
   return `<button type="button" aria-pressed="${filter===k}" data-filter="${k}"${ready?'':' disabled'}>
    <img src="./web/assets/shortage-${k}.png?v=shortageCards2" width="64" height="64" alt="">
    <span class="sh-metric-copy"><span>${title}</span><span class="sh-metric-value"><strong>${ready?count:readState==='error'?'無法取得':'待讀取'}</strong>${ready?'項':''}</span></span>
   </button>`;
  };
  const options=(entries,current)=>entries.map(([v,label])=>`<option value="${esc(v)}" ${current===v?'selected':''}>${esc(label)}</option>`).join('');
  const brands=[...new Set(rows.map(r=>r.brand))],categories=[...new Set(rows.map(r=>r.category).filter(Boolean))];
  c.innerHTML=`${shortageStyle}
   <div class="shortage-tabs"><button data-tab="records" aria-pressed="${recordTab}" class="${recordTab?'':'secondary'}">缺藥與補貨清單</button><button data-tab="substitutions" aria-pressed="${!recordTab}" class="${recordTab?'secondary':''}">替代候選</button></div>
   <p id="sh-state" role="status"></p>${localStorage.getItem('tcm-shortage-pending-v1')?'<button id="sh-retry">重試待確認儲存</button>':''}
   ${recordTab?`<div class="shortage-cards">${Object.entries(metricNames).map(([k,title])=>card(k,title)).join('')}</div>`:''}
   <section class="panel shortage-panel"><div class="panelhead"><h2>${recordTab?'缺藥與補貨清單':'替代候選'}</h2>
   <div class="actions"><button id="sh-new">＋${recordTab?'登記缺藥':'建立替代候選'}</button><button id="sh-reload" class="secondary">重新讀取</button></div></div>
   <div class="shortage-filters"><input id="sh-search" placeholder="搜尋藥名、編號或備註" value="${esc(query)}" aria-label="搜尋缺藥">
   <select id="sh-brand" aria-label="廠商">${options([['','全部廠商'],...brands.map(b=>[b,b])],brand)}</select>
   <select id="sh-category" aria-label="類別">${options([['','全部類別'],...categories.map(v=>[v,v])],category)}</select>
   ${recordTab?`<select id="sh-filter" aria-label="處理進度">${options([['','全部待處理'],...Object.entries(metricNames),['closed','已結案／取消'],['all','全部紀錄']],filter)}</select>`:''}</div>
   <div id="sh-list"></div>${recordTab?'<div class="sh-batch"><button id="sh-batch" disabled>將已選 0 項加入訂貨草稿</button><span id="sh-hidden" role="status"></span></div>':''}</section>`;
  const find=s=>c.querySelector(s),all=s=>Array.from(c.querySelectorAll(s));
  function goTab(dest){
   if(dest==='records'&&returnFilters)({query,brand,category,filter}=returnFilters);
   else filter='';
   returnFilters=null;alternativeSource=null;tab=dest;draw();
  }
  all('[data-tab]').forEach(b=>b.onclick=()=>goTab(b.dataset.tab));
  all('[data-filter]').forEach(b=>b.onclick=()=>{filter=filter===b.dataset.filter?'':b.dataset.filter;draw();});
  if(find('#sh-retry'))find('#sh-retry').onclick=()=>save(null,null,null,true);
  find('#sh-new').onclick=()=>recordTab?edit():substitute();
  find('#sh-reload').onclick=()=>load({fresh:true});find('#sh-reload').disabled=readState==='loading';find('#sh-new').disabled=!ready;
  const canOrder=({record,p,open})=>open&&record.status!=='deferred'&&p.toOrder>0;
  const orderableRecords=records.filter(canOrder);
  if(ready)for(const id of selectedIds)if(!orderableRecords.some(x=>x.record.id===id))selectedIds.delete(id);
  function updateBatch(){
   if(!recordTab)return;
   const visibleIds=new Set(all('[data-selected]').map(input=>input.dataset.selected));
   const hidden=[...selectedIds].filter(id=>!visibleIds.has(id)).length;
   find('#sh-batch').textContent='將已選 '+selectedIds.size+' 項加入訂貨草稿';
   find('#sh-batch').disabled=!ready||!selectedIds.size;
   find('#sh-hidden').textContent=hidden?'其中 '+hidden+' 項未顯示在目前清單':'';
  }
  function handoff(action,items){
   if(!alive||readState!=='ready')return;
   try{queueShortage(action,items);location.hash=action==='order'?'orders':'receive';}catch(e){status(e.message);}
  }
  if(recordTab)find('#sh-batch').onclick=()=>{
   const selected=orderableRecords.filter(x=>selectedIds.has(x.record.id)).map(({record,p})=>({...record,quantity:p.toOrder}));
   const operational=selected.filter(r=>!isOperationalOrderQa(r.sheet,r.code)),skipped=selected.length-operational.length;
   if(!selected.length)return status('請勾選有待補需求的品項');
   if(!operational.length)return status('驗收專用品項不會加入營運訂貨草稿');
   if(skipped)ask('<p>已排除 '+skipped+' 項驗收專用品項；只帶入其他營運品項。</p>',()=>handoff('order',operational),'只帶入營運品項');
   else handoff('order',operational);
  };
  const inputs=[['sh-search',v=>{query=v;alternativeSource=null;}],['sh-brand',v=>brand=v],['sh-category',v=>category=v]];
  if(recordTab)inputs.push(['sh-filter',v=>filter=v]);
  for(const [id,set] of inputs)find('#'+id).oninput=e=>{set(e.target.value);list();};
  function matches(it,note=''){
   const row=catalog.get(key(it));
   return (!brand||row?.brand===brand)&&(!category||row?.category===category)&&`${it.name} ${it.code} ${note}`.toLowerCase().includes(query.trim().toLowerCase());
  }
  function section(id,title,html){
   return html?`<details class="shortage-section" data-section="${id}" ${closedSections.has(id)?'':'open'}><summary>${title}</summary>${html}</details>`:'';
  }
  function recordRow(entry){
   const {record:r,row,p,open}=entry,id=esc(r.id);
   const button=(action,label)=>`<button type="button" data-${action}="${id}">${label}</button>`;
   const order=canOrder(entry),receive=open&&p.outstanding>0;
   const primary=(order?button('order','加入訂貨草稿'):'')+(receive?button('receive','登錄實際到貨'):'');
   const update=button('edit','更新追蹤');
   return `<article class="shortage-row"><div class="sh-item"><label class="check-label"><input type="checkbox" data-selected="${id}" ${selectedIds.has(r.id)?'checked':''} ${order?'':'disabled'} aria-label="選取 ${esc(r.name)}"><b>${esc(r.name)}</b></label><small>${esc(r.sheet+' · '+r.code)}</small>${r.note?`<small>${esc(r.note)}</small>`:''}</div>
    <div class="sh-stock">未拆封 ${row?.bottles==null?'待核對':esc(row.bottles)+' 瓶'}<small>${esc(labels[r.status])} · ${esc(labels[r.supply])}</small></div>
    <div class="sh-progress"><small>需補 ${r.need}　已訂 ${p.ordered}　已到 ${p.received}</small>
    ${p.toOrder>0?`<strong>尚需訂 ${p.toOrder} 瓶</strong>`:''}${p.outstanding>0?`<strong>待到 ${p.outstanding} 瓶</strong>`:''}
    ${r.eta?`<small>預計到貨 ${esc(r.eta)}</small>`:''}${p.invalidAllocations?'<small>關聯交易待核對，請查看歷程。</small>':''}</div>
    <div class="sh-actions">${primary||update}<details class="sh-more"><summary>更多操作</summary><div>${primary?update:''}${button('link-order','連結已有訂貨單')}${button('link-receipt','連結已有進貨單')}${button('alternatives','查看替代候選')}${button('history','查看歷程')}</div></details></div></article>`;
  }
  function list(){
   const el=find('#sh-list');
   if(readState!=='ready'){el.innerHTML=readState==='loading'?'<p role="status">正在讀取正式資料…</p>':'<p role="alert">讀取失敗：'+esc(readError)+'。請按「重新讀取」。</p>';return;}
   if(!recordTab){
    const scope=alternativeSource?`<p class="notice">查看此缺藥品項的替代設定：${esc(alternativeSource.name)}（${esc(alternativeSource.sheet)} · ${esc(alternativeSource.code)}）</p>`:'';
    const back=returnFilters?'<button type="button" class="secondary" id="sh-back">返回補貨清單</button>':'';
    const candidates=state.substitutions.filter(r=>alternativeSource?key(r.from)===key(alternativeSource)&&matches(r.from,r.note):matches(r.from,r.note)||query&&matches(r.to,r.note)).sort((a,b)=>a.priority-b.priority);
    el.innerHTML=back+scope+'<div class="shortage-illustration" aria-hidden="true"><img class="shortage-alchemist" src="./web/assets/shortage-alchemist-pixel.png" alt=""></div>'+(candidates.map(r=>`<article class="shortage-row"><div class="sh-item"><b>${esc(r.from.name)} → ${esc(r.to.name)}</b><small>${esc(r.from.sheet)} · ${esc(r.from.code)} → ${esc(r.to.sheet)} · ${esc(r.to.code)}</small></div><div>候選順序 ${esc(r.priority)}<small>${esc({pending:'待專業確認',confirmed:'已確認',disabled:'停用'}[r.status])}</small></div><div>${esc(r.note)}</div><div class="sh-actions"><button data-sub="${esc(r.id)}">編輯候選</button><button class="secondary" data-history="${esc(r.id)}">查看歷程</button></div></article>`).join('')||(state.substitutions.length?'<p>沒有符合條件的替代設定。</p>':'<p>尚無替代設定。</p>'));
    if(returnFilters)find('#sh-back').onclick=()=>goTab('records');
    all('[data-sub]').forEach(b=>b.onclick=()=>substitute(state.substitutions.find(r=>r.id===b.dataset.sub)));
   }else{
    const visible=records.filter(x=>matches(x.record,x.record.note)&&(filter==='all'||(filter==='closed'?!x.open:filter?includesMetric(x,filter):x.open))).sort((a,b)=>Number(b.record.priority==='urgent')-Number(a.record.priority==='urgent'));
    const checks=(!filter||filter==='pending'||filter==='all')?implicit.filter(row=>matches({sheet:row.name,name:row.drug,code:row.code})):[];
    const checkRows=checks.map(r=>`<article class="shortage-row"><div class="sh-item"><b>${esc(r.drug)}</b><small>${esc(r.name+' · '+r.code)}</small></div><div class="sh-stock">未拆封 0 瓶</div><div class="sh-progress">開封量待核對</div><div class="sh-actions"><button data-implicit="${esc(r.name+'|'+r.code)}">核對開封量</button></div></article>`).join('');
    el.innerHTML=section('check','待核對開封量',checkRows)+section('tracked','補貨追蹤',visible.map(recordRow).join(''))||'<p>沒有符合條件的紀錄。</p>';
    for(const d of all('[data-section]'))d.ontoggle=()=>{if(d.open)closedSections.delete(d.dataset.section);else closedSections.add(d.dataset.section);};
    all('[data-implicit]').forEach(b=>b.onclick=()=>edit(null,item(b.dataset.implicit)));
    all('[data-edit]').forEach(b=>b.onclick=()=>edit(state.records.find(r=>r.id===b.dataset.edit)));
    for(const kind of ['order','receipt'])all('[data-link-'+kind+']').forEach(b=>b.onclick=()=>showDetail(state.records.find(r=>r.id===b.getAttribute('data-link-'+kind)),(record,detail)=>link(record,kind,detail)));
    all('[data-selected]').forEach(e=>e.onchange=()=>{if(e.checked)selectedIds.add(e.dataset.selected);else selectedIds.delete(e.dataset.selected);updateBatch();});
    for(const action of ['order','receive'])all('[data-'+action+']').forEach(b=>b.onclick=()=>{
     const {record,p}=records.find(x=>x.record.id===b.getAttribute('data-'+action));
     if(action==='order'&&isOperationalOrderQa(record.sheet,record.code))return status('驗收專用品項不會加入營運訂貨草稿');
     const quantity=action==='order'?p.toOrder:p.outstanding;
     if(quantity>0)handoff(action,[{...record,quantity}]);
    });
    all('[data-alternatives]').forEach(b=>b.onclick=()=>{
     alternativeSource=state.records.find(r=>r.id===b.dataset.alternatives);
     returnFilters={query,brand,category,filter};query=brand=category=filter='';tab='substitutions';draw();
    });
    all('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(filter===b.dataset.filter)));
    updateBatch();
   }
   all('[data-history]').forEach(b=>b.onclick=()=>showDetail({id:b.dataset.history},history));
  }
  list();
 }
 load();return()=>{alive=false;};
}
