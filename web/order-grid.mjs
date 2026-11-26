import {preserveLegacyRegistration} from './registration-pending.mjs';
import {orderAddMarkup,bindOrderAdd} from './order-add.mjs';
import {chooseOrderFollowup,orderMergeTable} from './order-followup.mjs';
import {orderPrintControl,bindOrderPrint,orderRpc,openExistingOrderMail} from './order-print.mjs';
import {lossOrderEntries} from './loss-order-fill.mjs?v=release20261120r1';
import {beginProcessing,isProcessing} from './processing-screen.mjs';
import {alignOrderWord} from './order-word-axis.mjs';
import {createRefreshStatus} from './refresh-status.mjs';
import {supplyLayout} from './supply-layout.mjs';
import {protectDraft} from './page-safety.mjs';
import {mergeUnpostedOrders} from './order-merge-draft.mjs';
import {recoverPendingTransaction,lookupPostedTransaction} from './pending-recovery.mjs';
import {selectOrderExport,exportOrder} from './order-export.mjs';
import {periodControls,mountPeriodControls} from './period-controls.mjs?v=googlesync20261114';
import {seedShortage,shortageLinks,clearShortage} from './shortage-handoff.mjs?v=release20261120r1';
import {watchSupplierCatalog} from './catalog-events.mjs';
import {reconcileOrderInputs} from './order-refresh.mjs';
import {createSupplierLoader,loadOrderGridCatalog,supplierSelection} from './supplier-catalog.mjs?v=orderread20261119';
import {directReview,directLog} from './direct-sync.mjs?v=release20261120r1';
import {csvRows,sheetUrl} from './sheets-data.mjs';
import {cloudDraft} from '../src/cloud-transaction.mjs';
import {findPostedTransaction} from '../src/pending-transaction.mjs';
import {priceCents,money,pricingTotal} from './receipt-pricing.mjs';
import {orderKey,orderPrice,orderLines,sortOrderGrid} from './order-grid-data.mjs';
import {quantitySteppers} from './quantity-stepper.mjs';
import {today} from './store.mjs';
const KEY='tcm-cloud-pending-v1';
const columns=[['code','藥品／編號'],['brandCategory','廠牌／類別'],['bottles','未拆封瓶數'],['periodLoss','期間耗損量'],['quantity','本次確認訂量'],['price','單價（元／瓶）'],['amount','訂貨小計（元）'],['updated','原表更新欄']];
export function mountOrderGrid({esc,fmt,ask}){
 preserveLegacyRegistration(localStorage);
 const c=document.querySelector('#content'),$=s=>c.querySelector(s),quantities=new Map(),prices=new Map();let sources=[],rows=[],brand='',category='',sort='code',direction='asc',alive=true,busy=false,loadFailed=false;
 let manualLines=[],page=1,pageSize=10;
 let loadingScreen=null;let periodData=null,periodUI;let shortageSeeded=false,recoveringPrevious=false;const readCatalog=createSupplierLoader(loadOrderGridCatalog);
 const status=t=>{if(alive)$('#order-grid-state').textContent=t;};
 c.innerHTML=`${supplyLayout}<style>#order-grid td.order-period-loss{white-space:normal;min-width:180px;max-width:300px;line-height:1.6}#order-grid td.order-period-loss details{font-size:13px;line-height:1.7}#order-grid td.order-period-loss summary{cursor:pointer;min-height:44px;padding:8px}#order-grid th,#order-grid td{vertical-align:middle;text-align:right;font-variant-numeric:tabular-nums}#order-grid th:first-child,#order-grid td:first-child,#order-grid th:nth-last-child(-n+2),#order-grid td:nth-last-child(-n+2){text-align:left}#order-grid .sort-heading{color:inherit;background:transparent;border:0;padding:0;font:inherit;white-space:nowrap}#order-grid input{text-align:right;min-width:0;max-width:120px}#order-grid .order-price{width:72px}#order-grid .receipt-quantity{min-width:174px}.order-selector-label{display:block;margin-top:14px;margin-bottom:6px}#order-grid .quantity-stepper{grid-template-columns:26px 64px 26px 16px;gap:6px;width:150px;margin-inline:auto}#order-grid .quantity-stepper input{width:64px;height:34px;min-height:34px;font-size:14px;font-weight:400;padding:4px}#order-grid .quantity-adjust{width:26px;min-width:26px;min-height:28px;height:28px;font-size:18px;border-radius:5px}#order-grid .quantity-clear{height:22px;min-height:22px;padding:0 4px;font-size:12px;justify-self:center}#order-grid th:nth-child(5),#order-grid td:nth-child(5){text-align:center}#order-grid td small{display:block;line-height:20px;font-size:11px}#order-grid .order-price{width:72px;height:34px;min-height:34px;padding:4px 6px;font-size:14px}#order-grid th .sort-heading{width:100%;text-align:inherit}
#order-grid th:not(:first-child),#order-grid td:not(:first-child){text-align:center}
#order-grid tbody td{vertical-align:top;padding-top:16px;padding-bottom:16px;line-height:34px}
#order-grid tbody td:first-child{line-height:17px}
#order-grid tbody td:first-child .muted{line-height:17px}
#order-grid .quantity-stepper{line-height:normal}
#order-grid .order-price-control{display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
#order-grid .order-price-unit{flex:none}
#order-grid .order-price{box-sizing:border-box;min-width:72px;flex:0 0 72px;display:block;margin:0;text-align:center;appearance:textfield;-moz-appearance:textfield}
#order-grid .order-price::-webkit-inner-spin-button,#order-grid .order-price::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
#order-grid .quantity-clear{grid-column:2;justify-self:center;line-height:22px}
#order-grid .quantity-unit{font-size:13px;line-height:34px;text-align:center}
#content #order-grid th:first-child,#content #order-grid td:first-child{text-align:center;padding-left:60px;padding-right:60px}
#order-grid .order-brand-category{line-height:17px;white-space:nowrap}
@media(max-width:760px){
 #content #order-grid thead th:nth-child(4){display:block}
 #content #order-grid tbody td.order-brand-category{display:block!important;text-align:center!important}
 #content #order-grid tbody td.order-brand-category::before{display:block;text-align:center;margin:0 0 4px}
}
#og-page-options,#og-pagination{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px 14px;margin:12px 0}
#og-page-options label{display:flex;align-items:center;gap:8px;margin:0}
#og-page-size{width:auto;margin:0}
#og-pagination[hidden]{display:none}
#og-pending [data-order-print] button{margin:0}
</style><section class="panel"><h2>訂貨規劃</h2><a class="secondary" role="button" href="#orderPlanning">批次訂貨、建議量與舊草稿 →</a><p class="muted">依耗損計算建議量、編輯批次訂單及查看舊草稿。</p></section><section class="panel"><h2>登錄本次訂貨</h2><p>留白不訂貨，可跨廠商填寫後整批確認。確認量取代目前本周訂量；訂貨不增加庫存。</p><span class="order-selector-label">廠商</span><div id="order-brands" class="order-tabs" role="group" aria-label="廠商"></div><span class="order-selector-label">類別</span><div id="order-categories" class="order-tabs" role="group" aria-label="單方或複方"></div><form id="order-grid-form"><div class="grid"><label>訂貨日期<input id="og-date" type="date" value="${today()}" max="${today()}" required></label><label>經手人<select id="og-actor" data-staff required disabled><option>正在讀取員工名冊…</option></select></label></div><div class="panelhead receive-tools"><input id="og-search" aria-label="搜尋訂貨品項" placeholder="搜尋藥品名稱或編號"><button type="button" class="secondary" id="og-refresh">同步工作表庫存與單價</button><button type="button" class="secondary" id="og-export" disabled>匯出目前篩選結果</button></div><p id="og-export-status" role="status"></p>${periodControls}<div class="actions"><button type="button" id="og-fill-loss">將期間耗損量帶入訂量</button></div><p id="og-fill-note" role="status">更新耗損統計後，按「將期間耗損量帶入訂量」，將目前廠商／類別各品項的有效耗損總量填入訂貨草稿。零耗損與待核對品項保留原輸入，搜尋條件不影響帶入範圍。</p><label class="check-label"><input type="checkbox" id="og-only">只顯示本次已填品項（目前廠商／類別）</label><p id="order-grid-state" role="status">正在讀取廠商與品項…</p><p class="muted">點表頭切換升降冪；空白固定置底。只有月日的更新欄以訂貨日期年份排序。按「同步工作表庫存與單價」會以工作表最新單價取代所有本次手動單價，保留已填數量。單價帶入庫存表，可調整本次訂貨價格；不覆寫庫存表單價。</p><div id="og-page-options"><label>每頁顯示<select id="og-page-size"><option value="10">10 項</option><option value="20">20 項</option><option value="30">30 項</option></select></label><span id="og-page-range" role="status"></span></div><div class="tablewrap"><table id="order-grid"><thead><tr>${columns.map(([key,label])=>`<th>${key==='brandCategory'?'廠牌／類別':`<button type="button" class="sort-heading" data-og-sort="${key}">${label} ↕</button>${key==='code'?'<br><button type="button" class="sort-heading" data-og-sort="drug">藥名 ↕</button>':''}`}</th>`).join('')}<th>缺藥／缺藥率</th><th>原表</th></tr></thead><tbody></tbody></table></div><nav id="og-pagination" aria-label="藥品清單分頁" hidden><button type="button" class="secondary" id="og-prev">上一頁</button><span id="og-current-page" role="status"></span><button type="button" class="secondary" id="og-next">下一頁</button></nav>${orderAddMarkup}<div id="og-manual-list"></div><div class="actions"><span id="og-recovery-status" role="status"></span><strong id="og-summary" role="status"></strong><button type="button" class="secondary" id="og-clear">清除本次輸入</button><button id="og-submit" disabled>確認並預覽整批訂貨</button></div></form><div id="og-pending"></div><p class="muted">訂單單價與金額保存於 Google 訂貨紀錄；本周訂量同步至各廠商分頁。取消訂貨會還原上一筆有效確認量或原值。每批最多 100 項。</p></section>`;
 function allLines(){return [...orderLines(rows,quantities,prices),...manualLines];}
 function addLine(line){if(busy||loadFailed)throw Error('請等待品項讀取完成');if(line.manual)manualLines.push(line);else{const k=orderKey({name:line.sheet,code:line.code,drug:line.name});quantities.set(k,String(line.quantity));prices.set(k,String(line.unitPriceCents/100));}draw();}
 function manualList(){const box=$('#og-manual-list');box.innerHTML=manualLines.length?'<h3>手動新增訂貨品項（未建檔）</h3>'+manualLines.map((l,i)=>`<div class="order-add"><strong>${esc(l.sheet+' '+l.name)}</strong><p>編號：${esc(l.code||'未填（選填）')} · 單價：${money(l.unitPriceCents)}</p><label>訂貨量（瓶）<input type="number" min="1" max="1000000" step="1" data-manual-qty="${i}" value="${l.quantity}"></label><button type="button" data-manual-remove="${i}">移除此品項</button></div>`).join(''):'';box.querySelectorAll('[data-manual-qty]').forEach(e=>e.oninput=()=>{manualLines[Number(e.dataset.manualQty)].quantity=Number(e.value);summary();});box.querySelectorAll('[data-manual-remove]').forEach(e=>e.onclick=()=>{manualLines.splice(Number(e.dataset.manualRemove),1);draw();});}
 bindOrderAdd(c,()=>rows,allLines,addLine);
 function applyPeriod(){const map=new Map((periodData?.rows||[]).map(r=>[JSON.stringify([r.sheet,r.code]),r]));for(const r of rows){const p=map.get(JSON.stringify([r.name,r.code]));r.periodLoss=p?.name===r.drug&&Number.isFinite(p.total)?p.total:null;r.periodInfo=p?.name===r.drug?p:null;} }
 $('#og-fill-loss').onclick=()=>{
  if(busy||loadFailed||!periodData||$('#period-result').dataset.stale==='true'){ $('#og-fill-note').textContent='請先更新耗損統計並完成品項讀取，再帶入訂量。';return; }
  applyPeriod();const entries=lossOrderEntries(rows,brand,category),overwrites=entries.filter(([k])=>quantities.has(k)).length;
  if(!entries.length){$('#og-fill-note').textContent='目前廠商／類別沒有可帶入的有效正數耗損量。';return;}
  const data=periodData,selected=brand+category;
  const apply=()=>{if(!alive||busy||loadFailed||periodData!==data||$('#period-result').dataset.stale==='true'){if(alive)$('#og-fill-note').textContent='資料已變動，請重新帶入。';return;}for(const [k,q] of entries)quantities.set(k,q);draw();$('#og-fill-note').textContent=selected+'：已將 '+entries.length+' 項期間耗損帶入訂量。零耗損及待核對品項保留原輸入；尚未送出訂貨。';};
  if(overwrites)ask('<p>將 '+esc(selected)+' 的 '+entries.length+' 項耗損量帶入訂量，其中 '+overwrites+' 項會覆蓋已填訂量。其他品項保持原值。</p>',apply,'帶入期間耗損量');else apply();
 };
 function exportFilters(){return {brand,category,query:$('#og-search').value,only:$('#og-only').checked,sort,direction,date:$('#og-date').value};}
 $('#og-export').onclick=()=>{if(busy||loadFailed)return;try{const file=exportOrder(rows,quantities,prices,exportFilters()),url=URL.createObjectURL(new Blob([file.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=file.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#og-export-status').textContent='已產生 '+file.count+' 筆訂貨品項的 Excel；僅匯出，未送出訂貨。';}catch(e){$('#og-export-status').textContent=e.message;}};
 function draw(){if(!alive)return;manualList();
  applyPeriod();
  ({brand,category}=supplierSelection(sources,brand,category));
  const heading=$('[data-og-sort="periodLoss"]');if(heading)heading.textContent=(periodData?.period.label||'期間耗損量')+' ↕';
  const selection=supplierSelection(sources,brand,category);({brand,category}=selection);const brands=selection.brands,cats=selection.categories;
  $('#order-brands').innerHTML=brands.map(b=>`<button type="button" class="secondary ${b===brand?'selected':''}" data-brand="${esc(b)}" aria-pressed="${b===brand}">${esc(b)}</button>`).join('');
  $('#order-categories').innerHTML=cats.map(k=>`<button type="button" class="secondary ${k===category?'selected':''}" data-category="${esc(k)}" aria-pressed="${k===category}">${esc(k)}</button>`).join('');
  const list=selectOrderExport(rows,quantities,prices,exportFilters());
  const pageCount=Math.max(1,Math.ceil(list.length/pageSize));
  page=Math.min(page,pageCount);
  const start=(page-1)*pageSize;
  const end=Math.min(start+pageSize,list.length);
  $('#og-page-range').textContent=list.length?`顯示第 ${start+1}–${end} 項，共 ${list.length} 項`:'共 0 項';
  $('#og-current-page').textContent=`第 ${page} / ${pageCount} 頁`;
  $('#og-pagination').hidden=pageCount===1;
  $('#og-prev').disabled=page===1;
  $('#og-next').disabled=page===pageCount;
  $('#order-grid tbody').innerHTML=list.slice(start,end).map(r=>{const key=esc(orderKey(r));return `<tr data-category="${esc(r.category)}"><td><span class="aligned-drug"><span class="aligned-drug-icon" aria-hidden="true"></span><span class="aligned-drug-text"><b>${esc(r.drug)}</b><div class="muted">${esc(r.code||'缺編號')}</div>${r.warning?'<small>'+esc(r.warning)+'</small>':''}</span></span></td><td class="order-brand-category"><span>${esc(r.brand)}</span><div class="muted">${esc(r.category)}</div></td><td>${r.bottles===null?'待核對':fmt(r.bottles)+' 瓶'}</td><td class="order-period-loss">${r.periodLoss===null?'待核對':fmt(r.periodLoss)+' 瓶'}</td><td class="receipt-quantity"><input class="og-qty" type="number" min="1" max="1000000" step="1" inputmode="numeric" data-key="${key}" aria-label="${esc(r.code+' '+r.drug)} 本次確認訂量" value="${esc(quantities.get(orderKey(r))??'')}" placeholder="未訂貨"></td><td><span class="order-price-control"><input class="order-price" type="number" min="0" max="1000000" step="0.01" inputmode="decimal" data-price="${key}" aria-label="${esc(r.code+' '+r.drug)} 單價" value="${esc(orderPrice(r,prices))}" placeholder="未提供"><span class="order-price-unit">元</span></span>${r.priceWarning&&!prices.has(orderKey(r))?'<small class="pill warn">單價格式待核對</small>':''}</td><td data-amount="${key}">—</td><td>${esc(r.updated||'—')}</td><td>${esc([r.stockout,r.shortage].filter(Boolean).join('／')||'—')}</td><td><a href="${sheetUrl(r)}" target="_blank" rel="noopener">查看 ↗</a></td></tr>`;}).join('')||'<tr><td colspan="10">沒有符合的品項</td></tr>';
  c.querySelectorAll('[data-og-sort]').forEach(b=>{const active=b.dataset.ogSort===sort;b.textContent=b.textContent.replace(/[↑↓↕]$/,active?(direction==='asc'?'↑':'↓'):'↕');});
  c.querySelectorAll('.og-qty').forEach(e=>e.oninput=()=>{if(e.value==='')quantities.delete(e.dataset.key);else quantities.set(e.dataset.key,e.value);summary();});c.querySelectorAll('[data-price]').forEach(e=>e.oninput=()=>{prices.set(e.dataset.price,e.value);summary();});c.querySelectorAll('#order-grid tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>td.dataset.label=[...columns.map(x=>x[0]==='periodLoss'?(periodData?.period.label||x[1]):x[1]),'缺藥／缺藥率','原表'][i]||''));quantitySteppers(c,'.og-qty');c.querySelectorAll('.og-qty').forEach(input=>input.parentElement.querySelector('.quantity-clear').insertAdjacentHTML('beforebegin','<span class="quantity-unit">瓶</span>'));summary();
 }
 function summary(){if(!alive)return;$('#og-export').disabled=busy||loadFailed||!selectOrderExport(rows,quantities,prices,exportFilters()).length;let total=manualLines.reduce((n,l)=>n+l.quantity,0),lines=[...manualLines],invalid=manualLines.some(l=>!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>1000000)?'請核對新增品項訂貨量':'';for(const [key,value] of quantities){const r=rows.find(r=>orderKey(r)===key),q=Number(value);if(!r||rows.filter(x=>orderKey(x)===key).length!==1||r.warning?.includes('編號')||!Number.isInteger(q)||q<1||q>1000000){invalid='請核對品項與數量';continue;}total+=q;try{if(r.priceWarning&&!prices.has(key))throw Error();lines.push({quantity:q,unitPriceCents:priceCents(orderPrice(r,prices))});}catch{invalid='請核對單價';}}let cost;try{cost=pricingTotal(lines);}catch{invalid='金額超出範圍';}$('#og-summary').textContent=`已填 ${quantities.size+manualLines.length} 項（含其他分頁） · ${fmt(total)} 瓶 · ${invalid||((cost.missing?'已填單價小計：':'訂貨合計：')+money(cost.cents)+(cost.missing?'（'+cost.missing+' 項未提供單價）':''))}`;
 c.querySelectorAll('[data-amount]').forEach(e=>{const r=rows.find(r=>orderKey(r)===e.dataset.amount),q=quantities.get(e.dataset.amount);e.textContent='—';if(!q||!r)return;try{const p=priceCents(orderPrice(r,prices));e.textContent=p===undefined?'未提供':Number.isInteger(Number(q))&&Number(q)>0?money(p*Number(q)):'數量無效';}catch{e.textContent='單價待核對';}});$('#og-submit').disabled=busy||loadFailed||!(quantities.size+manualLines.length)||!!invalid;
 }
 const refreshStatus=createRefreshStatus($('#og-refresh'));
 async function load(syncPrices=false){if(busy){status('正在讀取 '+brand+category+'…');return;}busy=true;loadFailed=false;refreshStatus.start();summary();status('正在讀取 '+(brand+category||'廠商與品項')+'…');try{if(!isProcessing())loadingScreen=beginProcessing({reading:true,compact:true,catalogMessage:'正在向 Google 讀取'+(brand+category||'廠商與品項')+'的最新庫存與單價…'});const data=await readCatalog();if(!alive)return;reconcileOrderInputs(rows,data.rows,quantities,prices);sources=data.sources;rows=data.rows;if(!shortageSeeded){seedShortage('order',rows,quantities,orderKey);shortageSeeded=true;}if(syncPrices===true)prices.clear();draw();const selected=rows.filter(r=>r.brand===brand&&r.category===category);status(brand+category+'已更新，共 '+selected.length+' 項；'+new Date().toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'})+'。數量已保留，庫存與金額已更新。');}catch(e){loadFailed=true;status('讀取失敗：'+e.message+'；已填內容仍保留，請按重新讀取工作表重試。');}finally{loadingScreen?.close();loadingScreen=null;busy=false;if(alive){refreshStatus.finish(!loadFailed);summary();}}}
 function resetPage(){page=1;draw();}
 function turnPage(offset){
  page+=offset;
  draw();
  $('#og-page-options').scrollIntoView({block:'start'});
 }
 $('#og-prev').onclick=()=>turnPage(-1);
 $('#og-next').onclick=()=>turnPage(1);
 $('#og-page-size').onchange=e=>{pageSize=Number(e.target.value);resetPage();};
 function selectSource(){ $('#og-search').value='';$('#og-only').checked=false;resetPage();if(!busy&&!loadFailed)status(brand+category+'共 '+rows.filter(r=>r.brand===brand&&r.category===category).length+' 項，已保留訂量。');}
 const recoveryStatus=text=>{if(alive)$('#og-recovery-status').textContent=text;};
 const pendingChanged='待核對的交易已變更，已保留目前待核對紀錄。';
 const postedOwnershipLost='此筆已同步；另一筆待核對紀錄及本頁輸入已保留。請先核對，勿重複送出。';
 const postedFormInputs=new Set();
 const submittedFormInputs=new Map();
 let activeOrderPreview=null;
 const orderFormFingerprint=()=>JSON.stringify([$('#og-date').value,$('#og-actor').value,allLines().map(l=>JSON.stringify(l)).sort()]);
 function openOrderPreview(saved){
  const preview={
   assertOpen(){
    if(!alive||activeOrderPreview!==preview||localStorage.getItem(KEY)!==saved)throw Error('訂單狀態已變更，請重新預覽。');
   },
   onReturn(){
    if(!alive||activeOrderPreview!==preview)return;
    activeOrderPreview=null;
    const message=localStorage.getItem(KEY)===saved?'已返回訂貨表單，日期、經手人、各廠牌數量與單價已保留。':pendingChanged;
    recoveryStatus(message);
    $('#og-submit')?.focus?.({preventScroll:true});
   }
  };
  activeOrderPreview=preview;
  return preview;
 }
 const savePendingIfCurrent=(expected,record)=>{
  if(localStorage.getItem(KEY)!==expected)return false;
  localStorage.setItem(KEY,JSON.stringify(record));
  return true;
 };
 function completeOwnOrder(draft,submitted,input){
  if(submitted==null||!savePendingIfCurrent(submitted,{...draft,verified:true})){
   postedFormInputs.add(input);
   return false;
  }
  submittedFormInputs.delete(input);
  clearShortage('order');quantities.clear();prices.clear();manualLines=[];
  return true;
 }
 let resumedChoice=null;
 async function recoverPrevious(action,continueOrder=false,selection=null){
  if(recoveringPrevious||isProcessing())return;
  recoveringPrevious=true;
  const button=$('#og-recover-previous');
  button.disabled=true;
  button.textContent='處理上一筆'+action;
  let resumeRaw=null,caution='';
  const report=text=>recoveryStatus([text,caution].filter(Boolean).join('；'));
  const resume=()=>{if(alive){
   if(resumeRaw===null||resumeRaw!==localStorage.getItem(KEY)){showPending();recoveryStatus(pendingChanged);return;}
   resumedChoice=selection;$('#order-grid-form').requestSubmit();
  }};
  let autoResume=false;
  const completed=action==='進貨'?'上一筆進貨已入帳':'上一筆訂貨已同步';
  try{
   const outcome=await recoverPendingTransaction({
    action,ask,status:report,
    isActive:()=>alive,onChange:showPending,receiptRows:()=>rows,returnLabel:'返回訂貨',completionLabel:continueOrder?'繼續預覽本次訂貨':undefined,onContinue:continueOrder?resume:undefined,
    onResolved:async({alreadyPosted,posted})=>{
     const raw=localStorage.getItem(KEY);
     let matches=false;
     try{
      const shown=JSON.parse(raw||'null');
      matches=shown?.verified===true&&shown.id===posted.id&&JSON.stringify(cloudDraft(shown))===JSON.stringify(cloudDraft(posted));
     }catch{}
     showPending();
     if(!matches){caution=postedOwnershipLost;report('');return;}
     const recovered=[...submittedFormInputs].find(([,value])=>value===JSON.stringify(cloudDraft(posted)));
     if(recovered){
      const [input]=recovered;
      submittedFormInputs.delete(input);
      let unchanged=false;
      try{unchanged=input===orderFormFingerprint();}catch{}
      if(unchanged){clearShortage('order');quantities.clear();prices.clear();manualLines=[];draw();}
      else postedFormInputs.add(input);
      report(completed+'，已讀回原交易。'+(unchanged?'':'目前表單的修改已保留。'));
      return;
     }
     resumeRaw=raw;
     if(alreadyPosted&&continueOrder){autoResume=true;return;}
     if(alreadyPosted){
      recoveryStatus(completed+'。');
      ask('<h3>'+completed+'</h3><p>已填的訂貨數量和單價已保留。上一筆不會重複入帳。</p>',continueOrder?resume:()=>{},continueOrder?'繼續預覽本次訂貨':'返回訂貨',continueOrder?'返回訂貨':null);
     }else await load();
    }
   });
   if(alive&&outcome==='retry')button.textContent='再查一次';
  }catch(e){
   recoveryStatus(e.message);
  }finally{
   recoveringPrevious=false;
   if(autoResume)resume();
   if(alive&&$('#og-recover-previous'))$('#og-recover-previous').disabled=false;
  }
 }
 function showPending(){const expected=localStorage.getItem(KEY);let p;try{p=JSON.parse(expected||'null');}catch{}
  if(p&&!p.verified&&['進貨','訂貨'].includes(p.action)){
   const count=Array.isArray(p.lines)?p.lines.length:0;
   $('#og-pending').innerHTML=`<h3>${esc(p.date)} 有一筆${esc(p.action)}待確認，共 ${count} 項</h3><p>直接按「確認並預覽整批訂貨」，會先核對上一筆，再接續本次訂貨；已填數量與單價會保留。</p><button type="button" id="og-recover-previous">處理上一筆${esc(p.action)}</button>`;
   $('#og-recover-previous').onclick=()=>{
    if(localStorage.getItem(KEY)!==expected){showPending();recoveryStatus(pendingChanged);return;}
    return p.mergeOriginal?reviewPendingMerge(p,expected).catch(e=>status(e.message)):recoverPrevious(p.action);
   };
   return;
  }
  const checkButton='<button type="button" id="og-check" class="secondary">重新確認同步結果</button>';
  const cancelButton='<button type="button" class="secondary" id="og-cancel-posted">刪除本筆訂單</button>';
  const relevant=p&&['訂貨','取消訂貨'].includes(p.action);if(p?.verified&&!relevant)p=null;$('#og-pending').innerHTML=p?`<h3>${p.verified?'最近訂貨結果':'有一筆操作需要確認'}</h3><p>${esc(p.verified?(p.action==='取消訂貨'?'訂貨已取消，本周訂量已還原。':'訂貨量已同步至工作表，尚未入庫。'):(relevant?'上次訂貨尚未確認完成，請先查詢結果，避免重複訂貨。':'其他頁面的操作尚未確認完成，請先查詢結果或前往交易紀錄處理。'))}</p><p class="muted">${esc([p.date,p.actor,Array.isArray(p.lines)?p.lines.length+' 個品項':''].filter(Boolean).join(' · '))}</p><details><summary>查看交易明細</summary><p>${esc(p.action+' · '+p.id)}</p></details>${p.verified&&p.action==='訂貨'?orderPrintControl(p.id,cancelButton+checkButton):checkButton}`:'';if(!p)return;if(p.verified&&p.action==='訂貨'){
   bindOrderPrint($('#og-pending'),{onCancelOrder:cancelEditorOrder});
   $('#og-cancel-posted').onclick=()=>cancelPostedOrder(p,expected);
  }$('#og-check').onclick=async()=>{
  if(localStorage.getItem(KEY)!==expected){showPending();status(pendingChanged);return;}
  try{
   const found=findPostedTransaction(csvRows(await (await directLog(['訂貨','取消訂貨'].includes(p.action)?'orders':'inventory')).text()).slice(1),cloudDraft(p));
   if(!alive)return;
   if(localStorage.getItem(KEY)!==expected){showPending();status(pendingChanged);return;}
   if(!found)throw Error('未找到交易；請沿用同一編號核對');
   const verified=JSON.parse(found[1]).draft;
   if(!savePendingIfCurrent(expected,{...verified,verified:true})){showPending();status(pendingChanged);return;}
   showPending();await load();status('已確認工作表中的操作結果。');
  }catch(e){status(e.message);}
 };}
 function cancelEditorOrder(id){
  const expected=localStorage.getItem(KEY);
  let order;
  try{order=JSON.parse(expected);}catch{}
  if(!alive||order?.id!==id||order.action!=='訂貨'||order.verified!==true){
   status('訂單狀態已變更，請至交易紀錄核對原訂單。');return;
  }
  cancelPostedOrder(order,expected);
 }
 function cancelPostedOrder(order,expected){
  if(localStorage.getItem(KEY)!==expected){showPending();status(pendingChanged);return;}
  ask(`<h3>刪除本筆訂單</h3><p>訂單編號：${esc(order.id)}</p><p>確認後會登記取消訂貨，依工作表紀錄還原本周訂量。原交易紀錄會保留。</p><label>經手人<select id="og-cancel-actor" data-staff required disabled><option value="">正在讀取員工名冊…</option></select></label><label>取消原因<input id="og-cancel-reason" required></label>`,async()=>{
   try{
    if(localStorage.getItem(KEY)!==expected)throw Error(pendingChanged);
    const draft=cloudDraft({...order,id:'ERP-'+crypto.randomUUID(),action:'取消訂貨',reverses:order.id,date:today(),actor:document.querySelector('#og-cancel-actor').value,note:document.querySelector('#og-cancel-reason').value});
    let submitted;
    await directReview(draft,ask,async()=>{
     const owned=savePendingIfCurrent(submitted,{...draft,verified:true});
     if(alive){showPending();await load();if(!owned)status(pendingChanged);}
    },status,{beforeCommit:reviewed=>{
     if(!savePendingIfCurrent(expected,reviewed))throw Error(pendingChanged);
     submitted=JSON.stringify(reviewed);
     if(alive)showPending();
    }});
   }catch(e){status(e.message);}
  },'下一步：核對取消內容');
 }
 function currentDraft(id){
  return cloudDraft({kind:'tcm-cloud',version:2,currency:'TWD',id,action:'訂貨',date:$('#og-date').value,actor:$('#og-actor').value,note:'',lines:allLines(),shortageLinks:shortageLinks('order',orderLines(rows,quantities,prices))});
 }
 function reviewCombined(draft,saved,original,inputLines,ownsInput=true){
  const preview=openOrderPreview(saved);
  const input=orderFormFingerprint();let submitted,owned=false,caution='';
  return directReview(draft,ask,async()=>{
   owned=ownsInput?completeOwnOrder(draft,submitted,input):savePendingIfCurrent(submitted,{...draft,verified:true});
   if(!owned)caution=postedOwnershipLost;
   if(alive){showPending();if(owned)await load();}
  },text=>status([text,caution].filter(Boolean).join('；')),{
   onCancelOrder:cancelEditorOrder,autoMail:()=>alive&&owned,outputMergeIds:[],onReturn:preview.onReturn,
   reviewIntro:()=>'<h3>確認合併訂貨單</h3><p>以下為兩筆合併後的品項與數量。確認後一次同步，並開啟 PDF 核對。</p>',
   reviewLabel:'確認合併訂貨並同步',
   beforeCommit:()=>{
    preview.assertOpen();
    if(input!==orderFormFingerprint())throw Error('訂貨內容已變更，請重新預覽。');
    submitted=JSON.stringify({...draft,mergeOriginal:original,mergeInputLines:inputLines});
    localStorage.setItem(KEY,submitted);
    activeOrderPreview=null;
    if(ownsInput)submittedFormInputs.set(input,JSON.stringify(draft));
    if(alive)showPending();
   }
  });
 }
 async function reviewPendingMerge(prior,saved){
  if(busy||recoveringPrevious||isProcessing())return;
  busy=true;summary();
  try{
   const event=await lookupPostedTransaction(cloudDraft(prior));
   if(!alive)return;
   if(saved!==localStorage.getItem(KEY))throw Error('訂單狀態已變更，請重新核對。');
   const currentLines=JSON.stringify(allLines());
   const ownsInput=!prior.mergeOriginal||(prior.mergeInputLines===currentLines&&prior.date===$('#og-date').value&&prior.actor===$('#og-actor').value);
   if(event){
    const posted=cloudDraft(event.draft);
    localStorage.setItem(KEY,JSON.stringify({...posted,verified:true}));
    showPending();
    if(prior.mergeOriginal&&JSON.stringify(posted)===JSON.stringify(cloudDraft(prior))){
     // A lost response must not add the same input to the already-posted batch.
     if(ownsInput){submittedFormInputs.delete(orderFormFingerprint());clearShortage('order');quantities.clear();prices.clear();manualLines=[];draw();}
     openExistingOrderMail(posted.id,cancelEditorOrder);
     return;
    }
    resumedChoice={id:prior.id,mode:'merge'};
   }else{
    busy=false;summary();
    const original=prior.mergeOriginal||cloudDraft(prior);
    const combined=prior.mergeOriginal?cloudDraft(prior):mergeUnpostedOrders(original,currentDraft(prior.id));
    await reviewCombined(combined,saved,original,prior.mergeInputLines??currentLines,ownsInput);
    return;
   }
  }finally{busy=false;summary();}
  if(alive)$('#order-grid-form').requestSubmit();
 }
 function send(d,outputMergeIds=null,reviewIntro){
  const saved=localStorage.getItem(KEY);let input=orderFormFingerprint(),submitted,owned=false,caution='';
  const preview=openOrderPreview(saved);
  return directReview(d,(...args)=>{if(!submitted)recoveryStatus('');return ask(...args);},async()=>{
   owned=completeOwnOrder(d,submitted,input);
   if(!owned)caution=postedOwnershipLost;
   if(alive){showPending();if(owned)await load();}
  },text=>recoveryStatus([text,caution].filter(Boolean).join('；')),{
   onCancelOrder:cancelEditorOrder,autoMail:()=>alive&&owned,outputMergeIds,reviewIntro,onReturn:preview.onReturn,reviewLabel:reviewIntro?'確認本筆訂貨並開啟合併 PDF':'確認入帳',
   onDiscard:()=>ask('<h3>確定取消這次訂單？</h3><p>確認後會清除本次填寫的訂貨品項、數量與單價。</p>',()=>{
    if(!alive||submitted||activeOrderPreview!==preview)return;
    if(localStorage.getItem(KEY)!==saved){recoveryStatus(pendingChanged);return;}
    if(input!==orderFormFingerprint()){recoveryStatus('訂貨內容已變更，請重新預覽。');return;}
    activeOrderPreview=null;
    clearShortage('order');
    quantities.clear();prices.clear();manualLines=[];
    draw();recoveryStatus('已取消這次訂單。');
   },'確認取消這次訂單','返回修改',preview.onReturn),
   orderRows:()=>rows,onOrderAdd:line=>{preview.assertOpen();addLine(line);},onOrderDraft:next=>{preview.assertOpen();d=cloudDraft(next);input=orderFormFingerprint();},
   beforeCommit:reviewed=>{
    preview.assertOpen();
    if(input!==orderFormFingerprint()||(reviewed&&JSON.stringify(cloudDraft(reviewed))!==JSON.stringify(d)))throw Error('訂貨內容已變更，請重新預覽。');
    submitted=JSON.stringify(d);localStorage.setItem(KEY,submitted);
    activeOrderPreview=null;
    submittedFormInputs.set(input,JSON.stringify(d));
    showPending();
   }
  });
 }
 $('#order-brands').onclick=e=>{const b=e.target.closest('[data-brand]');if(b){brand=b.dataset.brand;selectSource();}};$('#order-categories').onclick=e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;selectSource();}};$('#og-search').oninput=resetPage;$('#og-only').onchange=resetPage;$('#og-date').onchange=draw;$('#og-refresh').onclick=()=>{if(!busy)load(true);};$('#og-clear').onclick=()=>{quantities.clear();prices.clear();manualLines=[];draw();};c.querySelectorAll('[data-og-sort]').forEach(b=>b.onclick=()=>{const key=b.dataset.ogSort;direction=sort===key&&direction==='asc'?'desc':'asc';sort=key;resetPage();});
 $('#order-grid-form').addEventListener('invalid',e=>{
  const field=e.target;
  recoveryStatus((field.getAttribute('aria-label')||field.closest('label')?.firstChild?.textContent||'訂貨欄位')+'：'+field.validationMessage);
 },true);
 $('#order-grid-form').onsubmit=async e=>{e.preventDefault();if(busy||loadFailed||recoveringPrevious||isProcessing()){recoveryStatus(loadFailed?'品項讀取失敗，請重新同步工作表。':'正在處理其他操作，請稍後再預覽。');return;}recoveryStatus('');try{
  const input=orderFormFingerprint();
  if(postedFormInputs.has(input))throw Error('這些輸入對應到剛完成的訂貨，請核對交易紀錄；請勿重複送出。');
  const expected=localStorage.getItem(KEY);let prior=JSON.parse(expected||'null');
  const pendingOrder=prior?.action==='訂貨'&&!prior.verified?JSON.stringify(cloudDraft(prior)):null;
  if(submittedFormInputs.has(input)&&submittedFormInputs.get(input)!==pendingOrder)throw Error('這筆訂貨已送出，請核對原交易紀錄。');
  if(pendingOrder&&[...submittedFormInputs.values()].includes(pendingOrder)){
   showPending();
   await recoverPrevious('訂貨');
   return;
  }
  if(prior&&!prior.verified&&['進貨','訂貨'].includes(prior.action)){
  const saved=localStorage.getItem(KEY);
  recoveryStatus('正在核對上一筆'+prior.action+'…');
  busy=true;summary();
  let posted;
  try{posted=await lookupPostedTransaction(cloudDraft(prior));}finally{busy=false;summary();}
  if(!alive)return;
  if(saved!==localStorage.getItem(KEY))throw Error('上一筆狀態已更新，請重新預覽。');
  recoveryStatus('');
  if(posted&&!prior.mergeOriginal){
   prior={...prior,...posted.draft,verified:true,...(prior.action==='進貨'?{receiptEvent:posted}:{})};
   localStorage.setItem(KEY,JSON.stringify(prior));
   showPending();
  }else{
   showPending();
   if(prior.mergeOriginal){await reviewPendingMerge(prior,localStorage.getItem(KEY));return;}

   let selection=null;
   if(prior.action==='訂貨'){
    const saved=localStorage.getItem(KEY);
    busy=true;summary();
    try{
     const mode=await chooseOrderFollowup({...prior,pending:true,count:prior.lines.length},{date:$('#og-date').value,actor:$('#og-actor').value,lines:allLines()});
     if(!alive||!mode)return;
     if(mode==='current'){recoveryStatus('上一筆尚未核對入帳，請先核對上一筆；本筆輸入已保留。');return;}
     if(saved!==localStorage.getItem(KEY))throw Error('上一筆狀態已更新，請重新預覽。');
     selection={id:prior.id,mode};
    }finally{busy=false;summary();}
   }
   if(selection?.mode==='merge'){await reviewPendingMerge(prior,localStorage.getItem(KEY));return;}
   await recoverPrevious(prior.action,true,selection);
   return;
  }
 }
 if(prior&&!prior.verified){
 busy=true;summary();const checking=beginProcessing({reading:true,compact:true,catalogMessage:'正在確認上一筆結果，已填訂量會保留…'});
  try{
   const found=findPostedTransaction(csvRows(await (await directLog(['訂貨','取消訂貨'].includes(prior.action)?'orders':'inventory')).text()).slice(1),cloudDraft(prior));
   if(!alive)return;
   if(localStorage.getItem(KEY)!==expected){showPending();throw Error(pendingChanged);}
   if(!found)throw Error('尚未找到上一筆結果，已填訂量保留。請按「重新確認同步結果」查詢上一筆操作。');
   const posted=JSON.parse(found[1]).draft;
   if(!savePendingIfCurrent(expected,{...posted,verified:true})){showPending();throw Error(pendingChanged);}
   showPending();
 }finally{checking.close();busy=false;summary();}
 }
 const selected=resumedChoice?.id===prior?.id?resumedChoice:null;resumedChoice=null;
 let outputMergeIds=null,reviewIntro;
 if(prior?.verified&&prior.action==='訂貨'){
  const saved=localStorage.getItem(KEY);
  busy=true;summary();const checking=beginProcessing({reading:true,compact:true,catalogMessage:'正在核對上一筆訂貨的寄送狀態，本筆輸入會保留…'});
  let previous;try{previous=await orderRpc('erpOrderFollowupStatus',prior.id);}finally{checking.close();busy=false;summary();}
  if(!alive)return;
  if(localStorage.getItem(KEY)!==saved)throw Error(pendingChanged);
  if(previous.state==='sending'||previous.state==='uncertain')throw Error('上一筆寄送結果待確認，請先查收信件並核對，系統不會自動重寄。本筆輸入已保留。');
  if(selected&&previous.state==='sent'&&selected.mode!=='current')throw Error('上一筆已寄送，請重新核對本次訂貨。');
  if(previous.state==='unsent'){
   const choice=selected?.mode??'current';
   if(choice!=='current'){
    busy=true;summary();let latest;try{latest=await orderRpc('erpOrderFollowupStatus',prior.id);}finally{busy=false;summary();}
    if(!alive)return;
    if(localStorage.getItem(KEY)!==saved)throw Error(pendingChanged);
    if(latest.state!=='unsent')throw Error('上一筆寄送狀態已變更，請重新核對；本筆輸入仍保留。');
    if(choice==='previous'){openExistingOrderMail(prior.id,cancelEditorOrder);return;}
   }
   outputMergeIds=choice==='merge'?[prior.id]:[];
   if(choice==='merge'){
    reviewIntro=current=>'<h3>確認本筆訂貨並預覽合併內容</h3><p>上一筆已同步。這一步同步本筆，接著開啟合併 PDF 編輯。</p><div class="tablewrap">'+orderMergeTable(previous.lines,current.lines)+'</div><h3>本步同步的品項（本筆）</h3>';
   }
  }
 }
 const d=currentDraft('ERP-'+crypto.randomUUID());await send(d,outputMergeIds,reviewIntro);}catch(e){recoveryStatus(e.message);}};
 const stopWordAxis=alignOrderWord($('#order-grid'));periodUI=mountPeriodControls(c,{ask,onData:data=>{periodData=data;draw();}});const syncPeriod=()=>periodUI.refresh();window.addEventListener('erp-synced',syncPeriod);const stopCatalogWatch=watchSupplierCatalog(()=>{load();periodUI.refresh();});showPending();load();return protectDraft(()=>{alive=false;loadingScreen?.close();loadingScreen=null;stopWordAxis();periodUI.dispose();window.removeEventListener('erp-synced',syncPeriod);stopCatalogWatch();},()=>quantities.size>0||prices.size>0||manualLines.length>0);
}
