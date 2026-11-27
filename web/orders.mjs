import {protectDraft} from './page-safety.mjs';
import {installPlanningMobile} from './planning-mobile.mjs';
import {planningLayout} from './planning-layout.mjs';
import {sortOrderRows,ORDER_COLUMNS} from './order-sort.mjs';
import {directEnabled,directReview,directSheet,runDirect} from './direct-sync.mjs?v=release20261120r1';
import {cloudDraft} from '../src/cloud-transaction.mjs?v=compact20261030';
import {ORDER_ENDPOINT} from './order-endpoint.mjs?v=cloud20261029';
import {SOURCES,SHEET_ID,csvRows,dailyExportUrl} from './sheets-data.mjs?v=qa20261029';
import {calculateOrderRows,previewOrder,numberOrNull,validateOrderStore,isOperationalOrderQa} from '../src/orders.mjs?v=planning20261127';
import {sheetPrice,pricingTotal,money} from './receipt-pricing.mjs';
import {orderLabel} from '../src/order-label.mjs';
import {today} from './store.mjs';
const ORDER_SHEET='1YcO7XRhN4T8wrL6wn-jD45lqif--rYQF4HCuBE-Nju8',GIDS={'科達單方':1285090474,'科達複方':1055167901,'天明單方':969684362,'天明複方':800389619},KEY='tcm-purchase-v2';
export function mountOrders({esc,fmt,ask:askBase}){
 const ask=(html,action,label='確認',cancelLabel)=>askBase(html,action,label,cancelLabel);
 const host=document.querySelector('#content'),abort=new AbortController();let alive=true,busy=false,sourceRead='idle',snapshot=null,quantities={},source=SOURCES[0],legacy=new Map(),lastSync='',page=0,pageSize=10,sortKey='code',sortDirection='asc';
 installPlanningMobile(host);
 const stored=()=>{const s=JSON.parse(localStorage.getItem(KEY)||'{"drafts":{},"orders":[]}');return validateOrderStore(s);};
 let savedDraftState;const draftState=(opts=options())=>JSON.stringify([opts,Object.entries(quantities).filter(([,v])=>v!==''&&v!=null).sort(([a],[b])=>a.localeCompare(b))]);
 const periodEnd=today();
 const firstDay=new Date(periodEnd+'T00:00:00Z');
 firstDay.setUTCDate(firstDay.getUTCDate()-3);
 const periodStart=firstDay.toISOString().slice(0,10);
 host.innerHTML=`${planningLayout}<style>
.planning-fill-toolbar,.planning-fill-buttons{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.planning-fill-toolbar{justify-content:space-between;margin:12px 0}.planning-fill-toolbar small{display:block;margin-top:4px}
#order-pager,.order-history-buttons{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
#order-pager{justify-content:flex-end;margin:12px 0}
#order-pager label{display:inline-flex;align-items:center;gap:8px;margin:0}
#order-pager select{margin:0;width:auto}
#order-pager button,#order-pager select{box-sizing:border-box;height:44px}
#order-history .order-history-buttons{margin-left:auto;justify-content:flex-start;flex:0 1 auto}
#order-history .order-history-buttons button{margin:0;flex:0 0 auto}
#order-read-dialog{width:min(440px,calc(100% - 32px));box-sizing:border-box;padding:24px;background:#172b46;color:#fff3d4;border:2px solid #dbaf65;border-radius:12px}
#order-read-dialog .read-content{display:flex;align-items:center;gap:16px}
#order-read-dialog strong{font-size:20px;color:#ffe8a3}
#order-read-dialog p{margin:6px 0;color:#fff3d4;overflow-wrap:anywhere}
#order-read-dialog progress{width:100%;accent-color:#e9be71}
#order-read-dialog [hidden]{display:none}
.plan-days-box{grid-column:1/-1;position:relative;min-width:0;margin-top:24px;padding:18px;border:1px solid #b68b35;border-radius:8px;background:#fff8e8;color:#203952}
.plan-days-bat{position:absolute;right:6px;top:-24px;width:76px;height:56px;object-fit:contain;pointer-events:none}
.plan-days-box h3{margin:0 78px 14px 0;color:#203952}
.plan-days-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
#plan-days-summary{font-weight:650;margin:16px 0 4px}
.plan-days-box p:last-child{margin:0}
@media(max-width:680px){.plan-days-fields{grid-template-columns:1fr}}
#content #order-settings-dialog{background:#172b46;color:#fff8e8;border-color:#e7bf72}
#content #order-settings-title{display:flex;align-items:center;gap:10px;color:#ffe8a3;border-bottom-color:#cfa955}
#content #order-settings-title::before{content:none}
#order-settings-title img{width:32px;height:32px;flex:none;image-rendering:pixelated}
#content #order-settings-dialog p{color:#fff8e8;line-height:1.65}

.order-grid th,.order-grid td{vertical-align:middle!important;text-align:right!important;font-variant-numeric:tabular-nums}
.order-grid th:first-child,.order-grid td:first-child,.order-grid th:last-child,.order-grid td:last-child{text-align:left!important}
.order-grid th:nth-child(8),.order-grid td:nth-child(8){text-align:center!important}
.order-grid .order-sort{display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;width:100%;min-height:40px;padding:0;background:transparent!important;border:0!important;box-shadow:none!important;color:inherit!important;font:inherit;text-align:inherit;white-space:nowrap;cursor:pointer}
.order-grid th:first-child .order-sort{justify-content:flex-start}.order-grid th:nth-child(8) .order-sort{justify-content:center}
.order-grid .order-sort:focus-visible{outline:2px solid #d5b86d;outline-offset:4px}
.order-grid td input[data-qty]{display:block;margin-left:auto;width:100%;min-width:88px;max-width:125px;text-align:right;box-sizing:border-box}
.order-grid th:nth-child(5),.order-grid td:nth-child(5){min-width:125px}
.exclusion-controls{display:flex;gap:10px;align-items:center;margin:8px 0;flex-wrap:wrap}.exclusion-controls input{flex:1 1 180px;min-width:0;width:auto;font-size:16px;min-height:44px}.exclusion-controls button{min-height:44px}#order-ignore-list{display:flex;flex-wrap:wrap;gap:8px}#order-ignore-list button{min-height:44px;padding:8px 12px;font-size:14px}.exclusion-picker{min-width:0}
</style><dialog id="order-read-dialog" aria-labelledby="order-read-title" aria-describedby="order-read-note">
 <div class="read-content"><img src="./web/assets/pixel-gear.gif" width="40" height="40" alt=""><div style="flex:1;min-width:0">
 <strong id="order-read-title" role="status"></strong><p id="order-read-note"></p><progress id="order-read-progress" aria-label="讀取中"></progress>
 <div id="order-read-actions" hidden><button type="button" id="order-read-close" class="secondary">返回修改</button> <button type="button" id="order-read-retry">重新讀取</button></div></div></div></dialog><section class="panel"><div class="panelhead planning-title"><div><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><h2>廠商訂貨工作台</h2><button type="button" class="secondary" id="order-settings-help">ⓘ 設定說明</button></div><dialog id="order-settings-dialog" aria-labelledby="order-settings-title"><h2 id="order-settings-title"><img src="./web/assets/pixel-gear.gif" width="32" height="32" alt="">訂貨設定說明</h2><p>耗損期間預設為今天往前 3 天至今天。</p><p>每次開啟工作台會清空上次手動排除的日期，週日自動排除。</p><p>目標備貨預設 3 天，可手動調整。</p><form method="dialog"><button>知道了</button></form></dialog><p class="muted">Google Sheets 即時讀取 · 瓶數制 · 確認前不入庫</p></div><a href="https://docs.google.com/spreadsheets/d/${ORDER_SHEET}/edit" target="_blank" rel="noopener">開啟原訂貨表 ↗</a></div><div class="order-tabs" role="group" aria-label="廠商與工作表">${SOURCES.map(s=>`<button class="secondary" data-source="${s.name}">${s.brand}｜${s.category}</button>`).join('')}</div><p id="order-state" role="status"></p><div class="grid"><label>耗損期間開始<input id="order-start" type="date" value="${periodStart}" required></label><label>耗損期間結束<input id="order-end" type="date" value="${periodEnd}" required></label><div class="full exclusion-picker"><label for="order-ignore-date">排除日期（週日已自動排除）</label><div class="exclusion-controls"><input id="order-ignore-date" type="date" aria-label="選擇排除日期"><button type="button" class="secondary" id="order-ignore-add">加入日期</button></div><div id="order-ignore-list" aria-label="已排除日期"></div><p id="order-ignore-message" class="muted" role="status"></p><input id="order-ignore" type="hidden"><p class="muted">可重複選擇多個日期；點日期旁的 × 可移除。變更後請重新計算耗損。</p></div><section class="plan-days-box" aria-labelledby="plan-days-title">
 <img class="plan-days-bat" src="./web/assets/order-settings-bat.png" alt="">
 <h3 id="plan-days-title">建議訂貨量設定</h3>
 <div class="plan-days-fields"><label>目標備貨天數<input id="order-days" type="number" min="1" max="90" step="0.5" value="3"></label><label>運送加成天數<input id="order-shipping" type="number" min="0" max="30" step="0.5" value="0.5"></label><label>假期加成天數<input id="order-holiday" type="number" min="0" max="90" step="0.5" value="0"></label></div>
 <p id="plan-days-summary" aria-live="polite"></p>
 <p class="muted">調整天數後，請按「讀取來源並計算耗損」更新各品項的建議量。</p>
 </section><label>經手人<select id="order-actor" data-staff required disabled><option value="">正在讀取員工名冊…</option></select></label></div><div class="actions"><button id="order-load">讀取來源並計算耗損</button></div><p class="muted">建議訂量向上取整瓶，最低為 0 瓶。耗損資料須完整，品項與庫存須通過核對，才會顯示建議量。此為基礎建議，未核對或扣除在途、開封中存量；請依已確認到貨日與實物人工調整。驗收專用品仍可搜尋，但不納入營運訂貨。</p></section><section class="panel"><div class="panelhead"><h2 id="order-heading"></h2><input id="order-search" aria-label="搜尋訂貨藥品" placeholder="搜尋藥名或編號"></div><label class="check-label"><input type="checkbox" id="order-only-filled">只顯示本次已填品項（目前廠商／類別）</label><p class="muted">點選欄位標題切換升冪／降冪；全部品項排序後再分頁，空白與無效值固定置底。藥名與編號可分別排序。缺藥率按百分比排序，僅有缺藥標記者排在 100% 之後。原表更新欄僅有月／日時，依耗損期間結束年份比較。</p><p id="order-average-help" class="muted">每日平均耗損（瓶／日）＝期間耗損合計 ÷ 所選期間開藥日數（排除週日與指定排除日期）。已有日期欄的空白耗損按 0 瓶計算，該日仍列入平均。缺少日期欄或耗損值無效時顯示「資料不足」。</p><div class="planning-fill-toolbar"><div><div class="planning-fill-buttons"><strong>填入本次訂貨量</strong><button class="secondary" id="order-usage">帶入期間耗損量</button><button class="secondary" id="order-suggest">帶入建議訂貨量</button></div><small id="planning-fill-note"></small></div><div id="order-pager"><label>每頁顯示 <select id="order-page-size"><option value="10">10 項</option><option value="20">20 項</option><option value="30">30 項</option></select></label><button class="secondary" id="order-prev">上一頁</button><span id="order-page"></span><button class="secondary" id="order-next">下一頁</button></div></div><div id="order-table"></div><p class="muted">在整批預覽中按「確認」後，草稿會保存在此瀏覽器。要繼續訂貨，請到「已確認訂貨草稿」按「確認並進行訂貨」。</p><div class="actions" style="justify-content:flex-end;flex-wrap:wrap"><strong id="order-total" role="status"></strong><button class="secondary" id="order-clear">清除本次輸入</button><button id="order-confirm">確認並預覽整批訂貨</button></div></section><section class="panel"><h2>已確認訂貨草稿</h2><div id="order-history"></div></section>`;
 const $=q=>host.querySelector(q),status=(s,error=false)=>{$('#order-state').textContent=s;$('#order-state').className=error?'error':'muted';};
 $('#order-settings-help').onclick=()=>$('#order-settings-dialog').showModal();
 function renderExcluded(){
 const dates=[...new Set($('#order-ignore').value.split(/[,，\s]+/).filter(Boolean))];
 $('#order-ignore-list').innerHTML=dates.map(d=>`<button type="button" class="secondary" data-remove-date="${esc(d)}" aria-label="移除排除日期 ${esc(d)}">${esc(d)} ×</button>`).join('');
 host.querySelectorAll('[data-remove-date]').forEach(b=>b.onclick=()=>{ $('#order-ignore').value=dates.filter(d=>d!==b.dataset.removeDate).join(','); render(); });
 }
 $('#order-ignore-add').onclick=()=>{
 const input=$('#order-ignore-date'),date=input.value,msg=$('#order-ignore-message');
 if(!date||!input.validity.valid){msg.textContent='請先從日曆選擇有效日期。';return;}
 if(new Date(date+'T12:00:00').getDay()===0){msg.textContent='週日已自動排除，不需另外加入。';return;}
 const dates=$('#order-ignore').value.split(/[,，\s]+/).filter(Boolean);
 if(dates.includes(date)){msg.textContent='這個日期已在排除清單中。';return;}
 $('#order-ignore').value=[...dates,date].sort().join(','); renderExcluded();input.value='';msg.textContent='已加入 '+date+'，請重新計算耗損。';render();
 };
 function options(){return {start:$('#order-start').value,end:$('#order-end').value,ignore:$('#order-ignore').value.split(/[,，\s]+/).filter(Boolean),targetDays:Number($('#order-days').value),shippingDays:Number($('#order-shipping').value),holidayDays:Number($('#order-holiday').value),blankAsZero:true};}
 function samePeriod(){return snapshot&&JSON.stringify(snapshot.options)===JSON.stringify(options());}
 function freshSnapshot(){return !busy&&sourceRead==='ready'&&samePeriod();}
 function updateDaysSummary(){
  const fields=['days','shipping','holiday'].map(name=>$('#order-'+name));
  const valid=fields.every(field=>field.value!==''&&Number.isFinite(Number(field.value))&&field.validity?.valid!==false);
  const days=fields.reduce((sum,field)=>sum+Number(field.value),0);
  $('#plan-days-summary').textContent=valid?`合計備貨 ${days} 天 ｜ 建議訂貨量 ＝ 每日平均耗損 × ${days} 天 − 未拆封庫存`:'請填寫有效的備貨、運送與假期天數。';
 }
 function render(){if(!alive)return;updateDaysSummary();renderExcluded();host.querySelectorAll('[data-source]').forEach(b=>b.classList.toggle('selected',b.dataset.source===source.name));$('#order-heading').textContent=source.name+' 訂貨單';const q=$('#order-search').value.trim().toLowerCase(),rows=sortOrderRows((snapshot?.rows||[]).filter(r=>(r.code+' '+r.name).toLowerCase().includes(q)&&(!$('#order-only-filled').checked||Number(quantities[r.id])>0)),sortKey,sortDirection,{quantities,legacy,referenceDate:snapshot?.options.end}),pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages-1);
 $('#order-table').innerHTML=snapshot?`<div class="tablewrap"><table class="order-grid planning-columns"><thead><tr>${ORDER_COLUMNS.map(([key,label])=>`<th aria-sort="${sortKey===key||key==='code'&&sortKey==='name'?(sortDirection==='asc'?'ascending':'descending'):'none'}"><button type="button" class="order-sort" data-order-sort="${key}" aria-label="${label.replaceAll('<br>',' ')}排序"><span>${label.split('<br>')[0]}</span><span aria-hidden="true">${sortKey===key?(sortDirection==='asc'?'↑':'↓'):'↕'}</span></button>${label.includes('<br>')?'<span class="planning-subtitle">'+label.split('<br>')[1]+'</span>':['quantity','suggested','stock'].includes(key)?'<span class="planning-subtitle">瓶</span>':''}${key==='code'?'<button type="button" class="order-sort" data-order-sort="name" aria-label="依藥品名稱排序">藥名 '+(sortKey==='name'?(sortDirection==='asc'?'↑':'↓'):'↕')+'</button>':''}</th>`).join('')}<th>品項資料檢查</th></tr></thead><tbody>${rows.slice(page*pageSize,(page+1)*pageSize).map(r=>`<tr data-category="${esc(r.category)}"><td data-label="藥品／編號"><small>${esc(r.code||'缺編號')}</small><br><b>${esc(r.name)}</b></td><td data-label="未拆封庫存" class="num">${r.stock===null?'未填':fmt(r.stock)}</td><td data-label="期間耗損（已填合計）" class="num">${fmt(r.usage)}</td><td data-label="建議訂貨量（瓶）" class="num">${isOperationalOrderQa(r.sheet,r.code)?'驗收專用・不帶入':r.suggested===null?esc(r.warnings.join('；')||'待核對'):fmt(r.suggested)+(freshSnapshot()?'':'（舊值・僅供參考）')}</td><td data-label="本次訂貨量（瓶）"><input type="number" min="0" step="1" max="100000" data-qty="${esc(r.id)}" aria-label="${esc(r.code+' '+r.name+' 本次訂貨量')}" value="${esc(quantities[r.id]??'')}" placeholder="待確認"${isOperationalOrderQa(r.sheet,r.code)&&!(Number(quantities[r.id])>0)?' disabled':''}></td><td data-label="每日平均耗損（瓶／日）" class="num">${r.average===null?'資料不足':fmt(r.average)}</td><td data-label="原表更新欄">${esc(r.stockDate||'未填')}</td><td data-label="缺藥／缺藥率">${esc([r.status,r.shortage].filter(Boolean).join('／')||'—')}</td><td data-label="品項資料檢查">${r.warnings.length?`<span class="pill warn">${esc(r.warnings.join('；'))}</span>`:'完整'}${r.blankDays&&snapshot.options.blankAsZero?'<div class="muted">空白耗損按 0 瓶計算</div>':''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">選擇廠商、工作表與耗損期間，再讀取來源。</div>';
 host.querySelectorAll('[data-order-sort]').forEach(b=>b.onclick=()=>{const key=b.dataset.orderSort;sortDirection=sortKey===key&&sortDirection==='asc'?'desc':'asc';sortKey=key;page=0;render();});host.querySelectorAll('[data-qty]').forEach(el=>el.oninput=()=>{quantities[el.dataset.qty]=el.value;total();});host.querySelectorAll('[data-qty]').forEach(el=>el.onchange=()=>{if($('#order-only-filled').checked&&!(Number(el.value)>0))render();});$('#order-prev').disabled=page===0;$('#order-next').disabled=page>=pages-1;$('#order-page').textContent=`顯示第 ${rows.length?page*pageSize+1:0}–${Math.min((page+1)*pageSize,rows.length)} 項，共 ${rows.length} 項`;$('#order-load').disabled=busy;$('#order-usage').disabled=$('#order-suggest').disabled=!freshSnapshot();$('#planning-fill-note').textContent=freshSnapshot()?'套用到目前分類的所有分頁，會取代可帶入品項的手填數量。':'請先依目前設定重新讀取並計算。';$('#order-confirm').disabled=!freshSnapshot();total();history();}
 function total(){
  const lines=[];let bottles=0,invalid=false;
  for(const row of snapshot?.rows||[]){
   const raw=quantities[row.id];
   if(raw==null||raw==='')continue;
   const quantity=numberOrNull(raw);
   if(!Number.isInteger(quantity)||quantity<0||quantity>100000){invalid=true;continue;}
   if(!quantity)continue;
   lines.push({quantity,...sheetPrice(row.planningPrice)});bottles+=quantity;
  }
  let amount;
  try{
   const {cents,missing}=pricingTotal(lines);
   amount=missing?'已知單價小計：'+money(cents)+'（'+missing+' 項單價待核對）':'訂貨合計：'+money(cents);
  }catch{amount='訂貨金額超出範圍';}
  $('#order-total').textContent=`已填 ${lines.length} 項（含其他分頁） · ${fmt(bottles)} 瓶 · ${invalid?'請核對訂貨量':amount}`;
 }
 const qaOrder=o=>o.lines.some(r=>isOperationalOrderQa(r.sheet,r.code));
 const orderBottles=order=>order.lines.reduce((total,line)=>total+line.quantity,0);
 function history(){
  const orders=stored().orders;
  $('#order-history').innerHTML=orders.length?orders.slice().reverse().map(o=>`<div class="order-history-row">
   <div><b>${esc(orderLabel(o.createdAt))}</b>${qaOrder(o)?'<div class="pill warn">驗收紀錄・無法送出訂貨</div>':''}<p class="muted">${esc(o.lines[0]?.sheet)} · ${esc(o.actor)} · ${esc(o.status)}<br>${esc(o.options.start)}～${esc(o.options.end)} · ${o.lines.length} 項／${fmt(orderBottles(o))} 瓶</p></div>
   <div class="order-history-buttons">
    <button type="button" data-send="${esc(o.id)}">確認並進行訂貨</button>
    <button type="button" class="secondary" data-clear-order="${esc(o.id)}">清除這筆訂單</button>
   </div>
  </div>`).join(''):'<p class="muted">尚無確認紀錄。</p>';
  host.querySelectorAll('[data-clear-order]').forEach(button=>button.onclick=()=>{
  const id=button.dataset.clearOrder;
  const selected=orders.find(order=>order.id===id);
  ask(`<h3>清除這筆訂單？</h3><p>${esc(orderLabel(selected.createdAt))}</p><p>${esc(selected.lines[0]?.sheet)} · ${selected.lines.length} 項／${fmt(orderBottles(selected))} 瓶</p><p>將從本機草稿清單移除這筆訂單。</p>`,async()=>{
   try{
    await navigator.locks.request(KEY,()=>{
     const state=stored(),index=state.orders.findIndex(order=>order.id===id);
     if(index<0||JSON.stringify(state.orders[index])!==JSON.stringify(selected))throw Error('草稿已變動，請重新核對。');
     state.orders.splice(index,1);localStorage.setItem(KEY,JSON.stringify(state));
    });
    history();status('已清除本機訂貨草稿 '+orderLabel(selected.createdAt));
   }catch(error){history();status(error.message,true);}
  },'確認清除','取消');
 });
 host.querySelectorAll('[data-send]').forEach(button=>button.onclick=()=>{
  const order=orders.find(record=>record.id===button.dataset.send);
  const latest=stored().orders.find(record=>record.id===order.id);
  if(JSON.stringify(latest)!==JSON.stringify(order)){
   history();
   return status('草稿已變動，請重新核對。',true);
  }
  if(qaOrder(order))return status('歷史草稿含驗收專用品項，請另建營運草稿後再同步',true);
  const draft=cloudDraft({kind:'tcm-cloud',version:1,id:'ERP-'+order.id,action:'訂貨',
   date:new Date(order.createdAt).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'}),
   actor:order.actor,note:'批次訂貨；耗損期間 '+order.options.start+'～'+order.options.end,lines:order.lines});
  if(directEnabled())return directReview(draft,ask,async()=>{},status);
  if(!ORDER_ENDPOINT)return status('Google 訂貨連線尚未設定。',true);
  const form=document.createElement('form'),input=document.createElement('input');
  form.method='POST';form.action=ORDER_ENDPOINT;form.target='_blank';form.rel='noopener';
  input.type='hidden';input.name='payload';input.value=JSON.stringify(draft);
  form.append(input);document.body.append(form);form.submit();form.remove();
  status('已開啟 Google 確認頁；請在該頁核對並確認訂貨。');
 });
 }
 async function fetchGrid(id,gid,range){const url=id===SHEET_ID?dailyExportUrl({gid}):`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}&range=${range}`;const r=directEnabled()&&id===SHEET_ID?await directSheet(SOURCES.find(s=>String(s.gid)===String(gid)),abort.signal):await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(30000)])});if(!r.ok||!r.headers.get('content-type')?.includes('text/csv'))throw Error('來源無法讀取，請確認 Google 分享權限');return csvRows(await r.text());}
 const readDialog=$('#order-read-dialog');
 function showReadState(error){
  $('#order-read-title').textContent=error?'讀取失敗':'正在讀取來源並計算耗損…';
  $('#order-read-note').textContent=error?source.name+' · '+error:source.name;
  $('#order-read-progress').hidden=!!error;
  $('#order-read-actions').hidden=!error;
  if(!readDialog.open)readDialog.showModal();
 }
 readDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 $('#order-read-close').onclick=()=>readDialog.close();
 $('#order-read-retry').onclick=load;
 async function load(){if(busy||!alive)return;busy=true;showReadState();sourceRead='loading';render();status('正在讀取 '+source.name+'…');const selected=source;try{const opts=options(),grid=(await runDirect('readLossPlanning',{sheet:selected.name,start:opts.start,end:opts.end})).values;const next=calculateOrderRows(grid,selected,opts);for(const row of next.rows)row.planningPrice=grid[row.sourceRow-1][4]??'';let old=new Map(),note='';if(GIDS[selected.name]){try{const g=await fetchGrid(ORDER_SHEET,GIDS[selected.name],'A1:E1000');if(g[0]?.[1]!=='編號')throw Error('欄位已變動');for(const r of g.slice(2))if(r[1])old.set(r[1],r[3]??'');}catch{note='；原表訂量對照讀取失敗';}}else note='；原訂貨表尚無此廠商分頁';if(!alive)return;snapshot=next;sourceRead='ready';readDialog.close();legacy=old;lastSync=new Date().toLocaleString('zh-TW');page=0;status(`已讀取 ${next.rows.length} 項 · ${lastSync} · 期間 ${opts.start}～${opts.end}${next.missing.length?' · 缺日期：'+next.missing.join('、'):''}${note}`);render();}catch(e){sourceRead='error';if(alive)showReadState(e.message||'無法讀取來源');if(alive)status(e.message+(snapshot?'；仍顯示上次快照與手填數量。重新讀取成功前不可帶入或確認。':'；請重新讀取。'),true);}finally{busy=false;if(alive)render();}}
 function select(s){$('#order-only-filled').checked=false;source=s;sourceRead='idle';page=0;const d=stored().drafts[s.name];snapshot=d?.snapshot||null;quantities=d?.quantities||{};legacy=new Map(d?.legacy||[]);lastSync=d?.lastSync||'';if(snapshot){const o=snapshot.options;$('#order-shipping').value=o.shippingDays;$('#order-holiday').value=o.holidayDays;}savedDraftState=draftState();status(d?'已載入本機草稿，請重新讀取才可帶入或確認。來源快照時間：'+lastSync:'請選擇期間並讀取來源');render();}
 host.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>{if(busy)return;if(draftState()!==savedDraftState){ask('<p>切換工作表會捨棄尚未確認的修改。確定要切換嗎？</p>',()=>select(SOURCES.find(s=>s.name===b.dataset.source)));}else select(SOURCES.find(s=>s.name===b.dataset.source));});
 $('#order-load').onclick=load;for(const field of ['start','end','days','shipping','holiday'])$('#order-'+field).addEventListener('input',render);$('#order-only-filled').onchange=$('#order-search').oninput=()=>{page=0;render();};$('#order-prev').onclick=()=>{page--;render();};$('#order-next').onclick=()=>{page++;render();};
 function applyQuantity(field,label){
  if(!freshSnapshot())return status('請先成功重新讀取目前期間與參數，尚未帶入數量',true);
  let applied=0;
  for(const row of snapshot.rows){
   const quantity=row[field];
   if(isOperationalOrderQa(row.sheet,row.code)||row.warnings.length||!Number.isFinite(row.average)||!Number.isSafeInteger(quantity)||quantity<0||quantity>100000)continue;
   quantities[row.id]=String(quantity);
   applied++;
  }
  render();
  if(!applied)return status(`目前分類沒有可帶入的${label}，請查看各品項的資料。`,true);
  status(`已將 ${applied} 項${label}帶入本次訂貨量，可再手動調整。`);
 }
 $('#order-usage').onclick=()=>applyQuantity('usage','期間耗損量');
 $('#order-suggest').onclick=()=>applyQuantity('suggested','建議訂貨量');
 $('#order-page-size').onchange=()=>{pageSize=Number($('#order-page-size').value);page=0;render();};
 $('#order-clear').onclick=()=>ask('<p>清除目前廠商分類所有分頁的本次訂貨量？</p>',()=>{
  quantities={};render();
 });
 $('#order-confirm').onclick=()=>{try{if(!freshSnapshot())throw Error('請先成功重新讀取目前期間與參數，尚未確認訂貨');const selectedSnapshot=snapshot;const order=previewOrder(snapshot,quantities,$('#order-actor').value,'PO-'+today().replaceAll('-','')+'-'+crypto.randomUUID(),new Date().toISOString());ask(`<h3>${esc(source.name)} 整批訂貨預覽</h3><ul>${order.lines.map(r=>'<li>'+esc(r.code)+' '+esc(r.name)+' · '+fmt(r.quantity)+' 瓶</li>').join('')}</ul><p>${esc($('#order-total').textContent)}</p><p>將保存為「已確認草稿・未送出」。不傳送廠商或增加庫存。</p>`,async()=>{try{await navigator.locks.request(KEY,()=>{if(!freshSnapshot()||snapshot!==selectedSnapshot)throw Error('來源已變動，請重新確認訂貨');const s=stored();if(s.orders.some(o=>JSON.stringify([o.options,o.lines,o.actor])===JSON.stringify([order.options,order.lines,order.actor])))throw Error('相同內容已確認，請使用既有訂單，避免重複訂貨');s.orders.push(order);s.drafts[source.name]={snapshot,quantities,legacy:[...legacy],lastSync};localStorage.setItem(KEY,JSON.stringify(s));savedDraftState=draftState(snapshot.options);});history();status('草稿已保存，可在「已確認訂貨草稿」繼續訂貨。');}catch(e){status(e.message,true);}});}catch(e){status(e.message,true);}};
 select(source);load();return protectDraft(()=>{alive=false;if(readDialog.open)readDialog.close();abort.abort();},()=>draftState()!==savedDraftState);
}
