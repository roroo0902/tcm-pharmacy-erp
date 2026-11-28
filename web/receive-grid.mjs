import {stockFilterStyles,filterHeading,sign,categoryButton} from './stock-filters.mjs';
import {receiptEntryDialog} from './receipt-entry-dialog.mjs';
import {beginProcessing,isProcessing,showReceiptReviewWarning} from './processing-screen.mjs';
import {createRefreshStatus} from './refresh-status.mjs';
import {supplyLayout} from './supply-layout.mjs';
import {protectDraft} from './page-safety.mjs';
import {operationResult} from './operation-result.mjs';
import {lookupPostedTransaction,recoverPendingTransaction} from './pending-recovery.mjs';
import {chooseReceiptMode} from './receipt-choice.mjs';
import {seedShortage,shortageLinks,clearShortage} from './shortage-handoff.mjs?v=release20261120r1';
import {watchSupplierCatalog} from './catalog-events.mjs';
import {reconcileOrderInputs} from './order-refresh.mjs';
import {loadReceiptCatalog,supplierSelection} from './supplier-catalog.mjs?v=receiptread20261119';
import {priceCents,money,pricingTotal} from './receipt-pricing.mjs?v=compact20261030';
import {quantitySteppers} from './quantity-stepper.mjs?v=stepper20261029';
import {directEnabled,directReview,directLog} from './direct-sync.mjs?v=release20261120r1';
import {csvRows} from './sheets-data.mjs?v=compact20261030';
import {cloudDraft} from '../src/cloud-transaction.mjs?v=compact20261030';
import {mergeReceipts} from '../src/receipt-merge.mjs';
import {receiptKey,receiptLines,sortReceiptRows,receiptPrice} from './receive-grid-data.mjs?v=compact20261030';
import {today} from './store.mjs';
import {LOSS_ENDPOINT} from './loss-cloud.mjs';
const KEY='tcm-cloud-pending-v1',SEPARATE='tcm-receipt-separate-v1',HIDDEN_RESULT='tcm-receipt-hidden-result-v1';
const savedTransaction=key=>JSON.parse(localStorage.getItem(key)||'null');
const sameDraft=(a,b)=>JSON.stringify(cloudDraft(a))===JSON.stringify(cloudDraft(b));

export function mountReceiptGrid({esc,fmt,ask}){
 const c=document.querySelector('#content'),$=s=>c.querySelector(s),abort=new AbortController(),quantities=new Map(),prices=new Map();
 // Ownership is scoped to this mounted form, never written into a pending transaction.
 let ownedNormalReceipt=null,activePreview=null;
 let rows=[],sources=[],source=null,brand='',category='',sort='code',direction='asc',alive=true,loading=false,loadFailed=false,ticket=0,pending=null,checkingPending=false;
 let shortageSeeded=false,shortageHandoff=null;
 const status=text=>{if(alive)$('#receipt-state').textContent=text;};
 c.innerHTML=`${stockFilterStyles}${supplyLayout}<style>
#receipt-process[hidden]{display:none}
#receipt-grid .receipt-price-control{display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
#receipt-grid .receipt-price-unit{flex:none;line-height:34px}
#receipt-grid .receipt-price{box-sizing:border-box;display:block;width:72px;min-width:72px;flex:0 0 72px;height:34px;min-height:34px;padding:4px 6px;margin:0;font-size:14px;line-height:22px;text-align:center;appearance:textfield;-moz-appearance:textfield}
#receipt-grid .receipt-price::-webkit-inner-spin-button,#receipt-grid .receipt-price::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
#receipt-grid tbody td{vertical-align:top;padding-top:16px;padding-bottom:16px;line-height:34px}
#receipt-grid tbody td:nth-child(1),#receipt-grid tbody td:nth-child(2),#receipt-grid tbody td .muted{line-height:17px}
#receipt-grid .quantity-stepper{grid-template-columns:26px 64px 26px 16px;gap:6px;width:150px;line-height:normal;margin-inline:auto}
#receipt-grid .quantity-stepper input{width:64px;height:34px;min-height:34px;padding:4px;font-size:14px}
#receipt-grid .quantity-stepper .quantity-adjust{width:26px;min-width:26px;height:28px;min-height:28px;font-size:18px}
#receipt-grid .quantity-clear{line-height:22px}
#receipt-grid .receipt-price-cell small:empty{display:none}
#content #receipt-grid tbody td{vertical-align:middle;line-height:1.5}
#content #receipt-grid tbody td:first-child:not([colspan]){padding:16px;text-align:center}
#content #receipt-grid tbody td:first-child::before{display:none}
#receipt-grid .receipt-drug{display:inline-flex;align-items:center;gap:10px;text-align:left;width:150px;max-width:100%;overflow-wrap:anywhere}
#receipt-grid .receipt-drug-text{display:block;min-width:0;white-space:normal;line-height:1.5}
#receipt-grid .receipt-drug-icon{display:block;flex:0 0 40px;width:40px;height:44px;background:url('./web/assets/herbal-powder.png') center/contain no-repeat;image-rendering:pixelated}
#receipt-grid tr[data-category="複方"] .receipt-drug-icon{background-image:url('./web/assets/potion-categories.png');background-size:200% 100%;background-position:right center}
#content #receipt-grid .quantity-stepper .quantity-clear{display:flex;align-items:center;justify-content:center;justify-self:stretch;box-sizing:border-box;line-height:1;height:28px;min-height:28px;padding:0 4px;margin:0}
@media(max-width:760px){#content #receipt-grid .quantity-stepper .quantity-clear{height:44px;min-height:44px}}
#receipt-page-options,#receipt-pagination{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px 14px;margin:12px 0}
#receipt-page-options label{display:flex;align-items:center;gap:8px;margin:0}
#receipt-page-size{width:auto;margin:0}
#receipt-pagination[hidden]{display:none}

#receipt-panel{min-width:0;background:#fffdf5}
#receipt-panel .receipt-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
#receipt-panel .receipt-heading h2{display:inline-flex;align-items:center;gap:10px;margin:0;padding:8px 17px;color:#fff2cb;background:#19354c;border:4px double #cea35a;border-radius:7px;box-shadow:0 2px 0 #685233;font-family:Georgia,"PMingLiU",serif;letter-spacing:.07em}
#receipt-panel .receipt-heading h2::before{display:none}
.receipt-crates{position:relative;width:28px;height:26px;flex:none}
.receipt-crates i,.receipt-crates::before,.receipt-crates::after{content:"";position:absolute;width:12px;height:12px;box-sizing:border-box;background:linear-gradient(90deg,#d6a052 39%,#fae2a2 39% 60%,#bd8338 60%);border:1px solid #8c602d;box-shadow:inset 0 2px #f9db91,inset -2px -2px #ab7534}
.receipt-crates i{left:8px;top:1px}.receipt-crates::before{left:1px;bottom:1px}.receipt-crates::after{right:1px;bottom:1px}
#content #receipt-panel #receipt-summary{display:block;border:0;padding:0;margin:16px 0 8px;background:none;color:#19354c;font:700 clamp(16px,2vw,22px)/1.5 Georgia,"PMingLiU",serif}
#receipt-panel .receive-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px}
#receipt-panel #receipt-search{width:min(100%,360px);margin:0}
#receipt-panel .receipt-filters,#receipt-panel .receipt-filters>div{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
#receipt-panel .receipt-filters{margin:14px 0;gap:12px 30px}
#receipt-panel .receipt-filters .order-tabs{margin:0}
#receipt-panel .receipt-record-details{margin:.4em auto 0;font-size:12px;color:#456075;line-height:1.5;text-align:center}
#receipt-panel .receipt-record-details dl{margin:6px 0;display:grid;grid-template-columns:auto auto;gap:3px 10px;text-align:left}#receipt-panel dd{margin:0}
#receipt-panel #receipt-grid{width:100%}
#receipt-panel #receipt-grid th{min-width:0;text-align:center}
#receipt-panel #receipt-grid .receipt-price-cell{min-width:90px}
#receipt-panel #receipt-grid .receipt-drug{width:auto}
#receipt-panel #receipt-submit{background:#1e3b55;color:#fff2cf;border:2px solid #cba354}
#receipt-panel .receipt-footer{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin:16px 0}
#receipt-panel .receipt-footer .actions{margin:0}
#receipt-panel #receipt-mobile-sort{width:auto;margin:0}
@media(min-width:761px){
 #receipt-grid .receipt-record-details{display:none}
 #receipt-panel #receipt-grid{border-collapse:collapse}
 #receipt-panel #receipt-grid th{background:#efdaa0;color:#213b54;border:1px solid #d7bf82;font-weight:700}
 #receipt-panel #receipt-grid th .sort-heading{color:inherit;background:transparent}
 #receipt-panel #receipt-grid tbody td{border:1px solid #e0d0a5}
 #receipt-panel #receipt-grid tbody tr:nth-child(odd){background:#fbf4df}
 #receipt-panel #receipt-grid tbody tr:nth-child(even){background:#fffef9}
 #content #receipt-panel #receipt-grid td.receipt-quantity,#content #receipt-panel #receipt-grid td.receipt-price-cell{vertical-align:middle;padding-block:35px}
 #receipt-panel #receipt-grid .receipt-price-cell{position:relative}
 #receipt-panel #receipt-grid .receipt-price-cell small{position:absolute;top:calc(50% + 19px);left:0;right:0;text-align:center}
}
@media(max-width:760px){
 #content #receipt-panel{padding:14px;min-width:0}
 #receipt-panel .receipt-heading h2{padding:6px 9px;font-size:18px}
 #receipt-panel .receipt-heading a{white-space:nowrap;padding:8px}
 #receipt-panel .receipt-filters{display:grid}
 #receipt-panel .receipt-filters>div{gap:5px 8px}
 #receipt-panel .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 #receipt-panel .grid label,#receipt-panel .grid input,#receipt-panel .grid select{min-width:0;width:100%;max-width:100%;box-sizing:border-box}
 #content #receipt-panel .tablewrap:has(#receipt-grid){overflow:visible;border:0;background:transparent}
 #content #receipt-panel #receipt-grid{border:0;background:transparent}
 #content #receipt-panel #receipt-grid thead{display:none}
 #content #receipt-panel #receipt-grid tbody td.receipt-desktop-detail[data-label]{display:none!important}
 #content #receipt-panel #receipt-grid tbody tr{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:8px 6px;padding:12px;border:1px solid #ccb994;border-radius:8px}
 #content #receipt-panel #receipt-grid tbody td[data-label]{display:block!important;text-align:left!important;padding:4px 0!important;margin:0;background:transparent;position:static}
 #content #receipt-panel #receipt-grid tbody td::before{display:none}
 #receipt-panel #receipt-grid tbody td:nth-child(2){justify-self:end;align-self:start}
 #receipt-panel #receipt-grid .receipt-drug-icon{display:none}
 #receipt-panel #receipt-grid .receipt-drug-text b{font-size:16px}
 #receipt-panel .receipt-record-details{text-align:left}
 #content #receipt-panel #receipt-grid td.receipt-quantity::before,#content #receipt-panel #receipt-grid td.receipt-price-cell::before{content:attr(data-label);display:block;position:static;margin:0 0 5px;padding:0;line-height:1.4}
 #content #receipt-panel #receipt-grid .quantity-stepper{width:100%!important;max-width:158px;grid-template-columns:minmax(24px,32px) minmax(34px,1fr) minmax(24px,32px)!important;gap:4px!important;margin:0!important}
 #content #receipt-panel #receipt-grid .quantity-adjust{width:100%;min-width:0;min-height:40px}
 #content #receipt-panel #receipt-grid .quantity-clear{width:100%!important;min-height:28px;height:28px}
 #receipt-panel #receipt-grid .quantity-unit{display:none}
 #receipt-panel #receipt-grid .receipt-price-control{justify-content:flex-start}
 #receipt-panel #receipt-grid .receipt-price{width:100%;min-width:0;flex:1;height:40px;font-size:16px}
 #content #receipt-panel #receipt-grid tbody td.receipt-amount{grid-column:1/-1;display:flex!important;justify-content:space-between;border-top:1px solid #dccfb8;padding-top:8px!important;font-weight:700}
 #content #receipt-panel #receipt-grid td.receipt-amount::before{display:inline;content:"小計"}
 #receipt-panel .receipt-footer #receipt-submit{width:100%}
 #receipt-panel #receipt-page-options{justify-content:flex-start}
}
</style><section class="panel" id="receipt-panel">
 <div class="receipt-heading"><h2><span class="receipt-crates" aria-hidden="true"><i></i></span>進貨登錄</h2><a class="secondary" href="#items">＋ 新增品項</a></div>
 <p id="receipt-summary" role="status"></p><p id="receipt-state" role="status">正在讀取共用廠商與品項…</p>
 <div class="panelhead receive-tools"><input id="receipt-search" type="search" aria-label="搜尋進貨品項" placeholder="搜尋藥品名稱或編號"><button type="button" id="receipt-refresh" class="secondary">重新讀取工作表</button></div>
 <div class="receipt-filters"><div>${filterHeading('廠商','receipt-brand-label')}<div id="receipt-brands" class="order-tabs stock-filter-tabs" role="group" aria-labelledby="receipt-brand-label"></div></div><div>${filterHeading('類別','receipt-category-label')}<div id="receipt-categories" class="order-tabs stock-filter-tabs" role="group" aria-labelledby="receipt-category-label"></div></div></div>
 <form id="receipt-form"><div class="grid"><label>進貨日期<input id="receipt-date" type="date" value="${today()}" max="${today()}" required></label><label>經手人<select id="receipt-actor" data-staff required disabled><option value="">正在讀取員工名冊…</option></select></label></div>
 <div id="receipt-page-options"><label>每頁顯示<select id="receipt-page-size"><option value="10">10 項</option><option value="20">20 項</option><option value="30">30 項</option></select></label><label>排序<select id="receipt-mobile-sort">${[['code','藥品編號'],['quantity','進貨數量'],['bottles','未拆封瓶數'],['updated','原表更新欄']].map(([key,label])=>['asc','desc'].map(dir=>`<option value="${key}:${dir}">${label} ${dir==='asc'?'↑':'↓'}</option>`).join('')).join('')}</select></label><span id="receipt-page-range" role="status"></span></div><div class="tablewrap"><table id="receipt-grid"><thead><tr><th><button type="button" class="sort-heading" data-sort="code">藥品／編號 ↑</button></th><th>廠牌／類別</th><th class="num"><button type="button" class="sort-heading" data-sort="bottles">未拆封瓶數 ↕</button></th><th class="receipt-quantity"><button type="button" class="sort-heading" data-sort="quantity">本次實收 ↕</button></th><th class="receipt-price-cell">單價（元／瓶）</th><th class="num">進貨小計（元）</th><th class="num">入庫後瓶數</th><th><button type="button" class="sort-heading" data-sort="updated">原表更新欄 ↕</button></th><th>缺藥標記／率</th></tr></thead><tbody></tbody></table></div><nav id="receipt-pagination" aria-label="藥品清單分頁" hidden><button type="button" class="secondary" id="receipt-prev">上一頁</button><span id="receipt-current-page" role="status"></span><button type="button" class="secondary" id="receipt-next">下一頁</button></nav><div class="receipt-footer"><button id="receipt-submit" disabled>預覽本次進貨</button><div class="actions"><button type="button" class="secondary" id="receipt-clear">清除本次輸入</button><span id="receipt-pending-status" role="status"></span><button type="button" id="receipt-process" hidden>處理上一筆進貨</button></div></div></form><div id="receipt-pending"></div><p class="muted">先在站內核對各品項原庫存、進貨量與入庫後瓶數，再按「確認入帳」。進貨只增加本次填入數量。重新讀取工作表會更新庫存與原表單價，保留已填數量及手動單價。單價由原表 E 欄帶入；確認入帳後，有填單價的進貨品項會同步更新 E 欄。留白不清除原表價格，0 為零元。金額依輸入單價計算，未另計稅額、折扣或運費。</p></section>`;
 const warnPreview=(message,onReview)=>{
  if(alive&&!isProcessing())showReceiptReviewWarning(message,onReview);
 };
 let page=1,pageSize=10;
 function draw(){
  if(!alive)return;
  const selection=supplierSelection(sources,brand,category);({brand,category,source}=selection);
  $('#receipt-brands').innerHTML=selection.brands.map(b=>sign(b,brand,'brand',esc)).join('');
  $('#receipt-categories').innerHTML=selection.categories.map(k=>categoryButton(k,category,esc)).join('');
  const query=$('#receipt-search').value.trim().toLowerCase(),list=sortReceiptRows(rows.filter(r=>r.name===source?.name&&`${r.drug} ${r.code}`.toLowerCase().includes(query)),quantities,sort,direction);
  const pageCount=Math.max(1,Math.ceil(list.length/pageSize));
  page=Math.min(page,pageCount);
  const start=(page-1)*pageSize;
  const end=Math.min(start+pageSize,list.length);
  $('#receipt-mobile-sort').value=sort+':'+direction;
  $('#receipt-page-range').textContent=list.length?`顯示第 ${start+1}–${end} 項，共 ${list.length} 項`:'共 0 項';
  $('#receipt-current-page').textContent=`第 ${page} / ${pageCount} 頁`;
  $('#receipt-pagination').hidden=pageCount===1;
  $('#receipt-prev').disabled=page===1;
  $('#receipt-next').disabled=page===pageCount;
  $('#receipt-grid tbody').innerHTML=list.slice(start,end).map(r=>{const reference=shortageHandoff?.records.find(x=>x.sheet===r.name&&x.code===r.code&&x.name===r.drug&&Number.isSafeInteger(x.quantity)&&x.quantity>0);return `<tr data-category="${esc(r.category)}"><td data-label="藥品／編號"><span class="receipt-drug"><span class="receipt-drug-icon" aria-hidden="true"></span><span class="receipt-drug-text"><b>${esc(r.drug)}</b><div class="muted">${esc(r.code)}</div>${r.warning?`<div class="muted">${esc(r.warning)}</div>`:''}</span></span><details class="receipt-record-details"><summary>庫存明細</summary><dl><dt>未拆封瓶數</dt><dd>${r.bottles===null?'待核對':fmt(r.bottles)+' 瓶'}</dd><dt>入庫後瓶數</dt><dd data-after="${esc(receiptKey(r))}">—</dd><dt>原表更新欄</dt><dd>${esc(r.updated||'—')}</dd><dt>缺藥標記／率</dt><dd>${esc([r.stockout,r.shortage].filter(Boolean).join('／')||'—')}</dd></dl></details></td><td data-label="廠牌／類別">${esc(r.brand)}<div class="muted">${esc(r.category)}</div></td><td class="receipt-desktop-detail" data-label="未拆封瓶數">${r.bottles===null?'待核對':fmt(r.bottles)+' 瓶'}</td><td data-label="進貨數量（瓶）" class="receipt-quantity"><input class="receipt-qty" data-key="${esc(receiptKey(r))}" aria-label="${esc(r.code)} ${esc(r.drug)} 本次實收瓶數" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="${esc(quantities.get(receiptKey(r))??'')}" placeholder="未進貨">${reference?`<small class="muted">帶入時待到 ${esc(reference.quantity)} 瓶（僅供參考）</small>`:''}</td><td data-label="單價（元／瓶）" class="receipt-price-cell"><span class="receipt-price-control"><input class="receipt-price" data-price-key="${esc(receiptKey(r))}" aria-label="${esc(r.code)} ${esc(r.drug)} 單價" type="number" min="0" max="1000000" step="0.01" inputmode="decimal" value="${esc(receiptPrice(r,prices))}" placeholder="未提供"><span class="receipt-price-unit">元</span></span><small>${esc(prices.has(receiptKey(r))?'本次輸入':r.priceWarning||'')}</small></td><td data-label="進貨小計（元）" class="num receipt-amount" data-amount="${esc(receiptKey(r))}">—</td><td class="receipt-desktop-detail" data-label="入庫後瓶數" data-after="${esc(receiptKey(r))}">—</td><td class="receipt-desktop-detail" data-label="原表更新欄">${esc(r.updated||'—')}</td><td class="receipt-desktop-detail" data-label="缺藥標記／率">${esc([r.stockout,r.shortage].filter(Boolean).join('／')||'—')}</td></tr>`;}).join('')||'<tr><td colspan="9">沒有符合的品項</td></tr>';
  c.querySelectorAll('[data-sort]').forEach(b=>{const active=b.dataset.sort===sort;b.parentElement.setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');b.textContent=b.textContent.replace(/[↑↓↕]$/,active?(direction==='asc'?'↑':'↓'):'↕');});
  c.querySelectorAll('.receipt-qty').forEach(el=>el.oninput=()=>{ownedNormalReceipt=null;if(el.value==='')quantities.delete(el.dataset.key);else quantities.set(el.dataset.key,el.value);summary();});
  c.querySelectorAll('.receipt-price').forEach(el=>el.oninput=()=>{ownedNormalReceipt=null;prices.set(el.dataset.priceKey,el.value);el.closest('.receipt-price-cell').querySelector('small').textContent='本次輸入';summary();});
  quantitySteppers(c,'.receipt-qty');
  c.querySelectorAll('.receipt-qty').forEach(input=>input.parentElement.querySelector('.quantity-clear').insertAdjacentHTML('beforebegin','<span class="quantity-unit">瓶</span>'));
  summary();
 }
 const catalogStatus=()=>status(`${source?.name||'尚無分類'} · ${rows.filter(r=>r.name===source?.name).length} 項 · 共 ${sources.length} 個分類 · 已保留數量；單價依原表 E 欄帶入，手動修改以欄位標示為準`);
 function summary(){
  let count=0,total=0,invalid=false;
  for(const v of quantities.values()){if(v==='')continue;count++;const n=Number(v);if(!Number.isInteger(n)||n<1||n>1000000)invalid=true;else total+=n;}
  $('#receipt-summary').textContent=`已填 ${count} 項（含其他分頁） · ${invalid?'請核對數量':fmt(total)+' 瓶'}`;
  const current=[];let priceInvalid=false;
  for(const [key,q] of quantities){const r=rows.find(x=>receiptKey(x)===key);if(!r||!Number.isInteger(Number(q))||Number(q)<1)continue;try{if(r.priceWarning&&!prices.has(key))throw Error();current.push({quantity:Number(q),unitPriceCents:priceCents(receiptPrice(r,prices))});}catch{priceInvalid=true;}}
  try{const cost=pricingTotal(current);$('#receipt-summary').textContent+=' · '+(priceInvalid?'請核對單價':(cost.missing?'已填單價小計 ':'進貨合計 ')+money(cost.cents)+(cost.missing?'（'+cost.missing+' 項未填單價）':''));}catch(e){$('#receipt-summary').textContent+=' · '+e.message;}
  c.querySelectorAll('[data-amount]').forEach(el=>{const key=el.dataset.amount,q=quantities.get(key),r=rows.find(x=>receiptKey(x)===key);el.textContent='—';if(!q||!r)return;try{const cents=priceCents(receiptPrice(r,prices));el.textContent=cents===undefined?'未提供':Number.isInteger(Number(q))&&Number(q)>0?money(cents*Number(q)):'數量無效';}catch{el.textContent='單價待核對';}});
  $('#receipt-submit').disabled=loading||loadFailed||!count;
  c.querySelectorAll('[data-after]').forEach(el=>{const v=quantities.get(el.dataset.after),r=rows.find(x=>receiptKey(x)===el.dataset.after),n=Number(v);el.textContent=v==null||v===''?'—':!Number.isInteger(n)||n<1||n>1000000?'數量無效':!Number.isInteger(r?.bottles)||r.bottles<0?'待核對':fmt(r.bottles+n)+' 瓶';});
 }
 const refreshStatus=createRefreshStatus($('#receipt-refresh'));
 let catalogScreen;
 const closeCatalogScreen=()=>{catalogScreen?.close();catalogScreen=null;};
 async function load(refresh=false,{showDialog=false,compact=true,fresh=false}={}){
  closeCatalogScreen();
  let readAt;const run=++ticket;loading=true;refreshStatus.start();loadFailed=false;status('正在讀取 '+(brand+category||'共用廠商與品項')+'…');$('#receipt-submit').disabled=true;
  try{if(showDialog&&!isProcessing())catalogScreen=beginProcessing({reading:true,receiptGuild:!compact,receiptCompact:compact,catalogMessage:"正在讀取廠商與品項…"});const data=await loadReceiptCatalog({fresh:fresh||refresh===true});if(!alive||run!==ticket)return;readAt=data.readAt;reconcileOrderInputs(rows,data.rows,quantities,prices);sources=data.sources;rows=data.rows;if(!shortageSeeded){shortageHandoff=seedShortage('receive',rows,quantities,receiptKey)||null;shortageSeeded=true;}draw();catalogStatus();}
  catch(e){if(alive&&run===ticket){loadFailed=true;status(e.message+'；已填數量仍保留，請重新讀取工作表重試');}}
  finally{if(alive&&run===ticket){closeCatalogScreen();loading=false;refreshStatus.finish(!loadFailed,readAt);summary();$('#receipt-submit').disabled=loadFailed||$('#receipt-submit').disabled;}}
 }
 const processButton=$('#receipt-process');
 const pendingStatus=text=>{if(alive)$('#receipt-pending-status').textContent=text;};
 let pendingKey=KEY;
 function showPending(){
  pendingKey=KEY;
  let primary;
  try{
   primary=savedTransaction(KEY);
   const separate=savedTransaction(SEPARATE);
   if(separate&&!separate.verified){pendingKey=SEPARATE;pending=separate;}
   else pending=primary;
  }catch{pending=null;}
  processButton.hidden=!(pending?.action==='進貨'&&!pending.verified);
  processButton.textContent=pendingKey===SEPARATE?'處理本次待核對進貨':'處理上一筆進貨';
  $('#receipt-pending').innerHTML=operationResult(pending,'receipt',localStorage.getItem(HIDDEN_RESULT));
  if(pendingKey===SEPARATE&&primary?.action==='進貨'&&!primary.verified){
   $('#receipt-pending').insertAdjacentHTML('afterbegin','<p>本次進貨待核對。上一筆進貨也已保留，核對完本次即可繼續處理。</p>');
  }
  if(!pending)return;
  if($('#receipt-hide'))$('#receipt-hide').onclick=()=>{localStorage.setItem(HIDDEN_RESULT,pending.id);showPending();};
  if($('#receipt-check'))$('#receipt-check').onclick=()=>checkPending();
 }
 let closeEntry=null;
 function openEntry(){
  showPending();if(!alive||pending?.action!=='進貨'||pending.verified)return;
  closeEntry?.();closeEntry=receiptEntryDialog(pending,{esc,onCheck:()=>checkPending(true),onCancel:cancelPending});
 }
 async function cancelPending(){
  if(checkingPending||isProcessing())return;
  const key=pendingKey,saved=localStorage.getItem(key);
  ask('<h3>取消該筆進貨？</h3><p>僅取消本機待處理草稿，不會取消廠商訂單。確認前請確定其他視窗或裝置沒有正在送出這筆進貨。</p><p>系統將重新查詢；已入帳或查詢失敗時不會取消。</p>',async()=>{
   checkingPending=true;processButton.disabled=true;
   try{
    const current=JSON.parse(saved||'null'),d=cloudDraft(current);
    const event=await lookupPostedTransaction(d);
    if(!alive)return;
    if(localStorage.getItem(key)!==saved)throw Error('待處理交易已變動，請重新核對。');
    if(event)throw Error('這筆進貨已入帳，請到交易紀錄執行沖銷。');
    // Retain the original ID and full draft for audit/recovery; never delete server records.
    localStorage.setItem('tcm-receipt-cancelled-'+d.id,JSON.stringify({...current,cancelledAt:new Date().toISOString()}));
    localStorage.removeItem(key);showPending();summary();
    pendingStatus('已取消本機進貨草稿，原交易資料已保留；未修改庫存。');
   }catch(e){pendingStatus(e.message);warnPreview(e.message);}
   finally{checkingPending=false;if(alive)processButton.disabled=false;}
  },'確認取消本機草稿','返回');
 }
 processButton.onclick=()=>checkPending(true);
 async function checkPending(recovering=false){
  if(checkingPending||isProcessing())return;
  checkingPending=true;
  processButton.disabled=true;
  let caution='';
  const report=recovering?text=>pendingStatus([text,caution].filter(Boolean).join('；')):status;
  try{
   if(recovering){
    processButton.textContent=pendingKey===SEPARATE?'處理本次待核對進貨':'處理上一筆進貨';
    const storageKey=pendingKey;
    const outcome=await recoverPendingTransaction({
     action:'進貨',ask,status:report,isActive:()=>alive,onChange:showPending,receiptRows:()=>rows,storageKey,
     onResolved:async({alreadyPosted,posted,pending:original})=>{
      let preserved=false;
      if(original.receiptInput&&(!alreadyPosted||sameDraft(posted,original)))consumeCurrent(original.receiptInput);
      else if(storageKey===KEY&&!original.receiptInput&&!original.receiptMerge){
       if(consumeOwnedNormal(original,posted,alreadyPosted))draw();
       else preserved=quantities.size>0||prices.size>0;
      }
      if(storageKey===SEPARATE&&savedTransaction(SEPARATE)?.verified&&savedTransaction(SEPARATE)?.id===posted.id)localStorage.removeItem(SEPARATE);
      showPending();
      if(preserved){caution='已核對上一筆；目前輸入已保留。請重新確認，避免重複入帳。';report('');}
      else if(alreadyPosted)report('已查到這筆進貨的入帳紀錄。');
      await load();
     }
    });
    if(alive&&outcome==='retry')processButton.textContent='再查一次';
    return;
   }
   report('正在查詢上一筆入帳結果…');
   const saved=localStorage.getItem(KEY);
   const d=cloudDraft(JSON.parse(saved||'null'));
   const res=await directLog(['訂貨','取消訂貨'].includes(d.action)?'orders':'inventory');
   const [header,...records]=csvRows(await res.text());
   if(header&&(header[0]!=='交易編號'||header[1]!=='交易JSON'))throw Error('交易紀錄表頭無法核對');
   const found=records.find(r=>r[0]===d.id);
   if(!alive)return;
   if(saved!==localStorage.getItem(KEY)){
    showPending();
    report('上一筆狀態已更新，請查看目前狀態。');
    return;
   }
   if(!found){
    report('查無這筆入帳紀錄，請回原操作頁核對。');
    return;
   }
   const event=JSON.parse(found[1]),posted=event.draft;
   if(posted?.id!==d.id||posted.action!==d.action)throw Error('交易紀錄內容無法核對');
   localStorage.setItem(KEY,JSON.stringify({...posted,verified:true,receiptEvent:event}));
   showPending();
   report(posted.action==='進貨'?'上一筆已入帳。目前填寫的進貨已保留。':'已確認先前操作結果，可以繼續進貨。');
  }catch(e){
   if(alive){
    report('暫時無法確認入帳狀態。'+e.message);
    if(recovering)processButton.textContent='再查一次';
   }
  }finally{
   checkingPending=false;
   processButton.disabled=false;
  }
 }
 function currentDraft(id='ERP-'+crypto.randomUUID()){
  const lines=receiptLines(rows,quantities,prices),priced=lines.some(l=>l.unitPriceCents!==undefined);
  return cloudDraft({kind:'tcm-cloud',version:priced?2:1,...(priced?{currency:'TWD'}:{}),id,action:'進貨',date:$('#receipt-date').value,actor:$('#receipt-actor').value,note:'',lines,shortageLinks:shortageLinks('receive',lines)});
 }
 function clearCurrent(){
  clearShortage('receive');
  shortageHandoff=null;
  quantities.clear();
  prices.clear();
 }
 function consumeCurrent(original){
  try{if(sameDraft(currentDraft(original.id),original))clearCurrent();}catch{}
 }
 function normalReceiptSignature(id){
  const sorted=map=>[...map].sort(([a],[b])=>a<b?-1:a>b?1:0);
  return JSON.stringify([currentDraft(id),sorted(quantities),sorted(prices)]);
 }
 function matchesOwnedNormal(id,owned){
  try{return !!owned&&owned.id===id&&normalReceiptSignature(id)===owned.form;}catch{return false;}
 }
 function consumeOwnedNormal(original,posted,alreadyPosted){
  const owned=ownedNormalReceipt;
  if(!matchesOwnedNormal(original.id,owned))return false;
  try{
   if(JSON.stringify(cloudDraft(original))!==owned.pending)return false;
   if(alreadyPosted&&!sameDraft(posted,original))return false;
   const stored=savedTransaction(KEY);
   if(stored?.verified!==true||stored.id!==original.id||!sameDraft(stored,posted))return false;
  }catch{return false;}
  ownedNormalReceipt=null;clearCurrent();
  return true;
 }
 async function checkDisplacedReceipt(owned,prior,separate){
  const original=JSON.parse(owned.pending);
  checkingPending=true;
  pendingStatus('正在依原交易編號核對本筆進貨…');
  try{
   const event=await lookupPostedTransaction(original);
   if(!alive||ownedNormalReceipt!==owned||!matchesOwnedNormal(original.id,owned))return;
   if(event){
    if(!sameDraft(event.draft,original))throw Error('原交易編號的入帳內容不同，請核對交易紀錄。');
    ownedNormalReceipt=null;clearCurrent();draw();showPending();
    pendingStatus('本筆進貨已入帳。其他分頁的交易已保留。');
    return;
   }
   if(localStorage.getItem(KEY)!==prior||localStorage.getItem(SEPARATE)!==separate||
    [prior,separate].some(raw=>raw&&!JSON.parse(raw).verified)){
    showPending();pendingStatus('原交易仍待核對，請先處理另一筆待確認操作。');return;
   }
   // The prior request may still be in flight. Even after a negative read, retry only its original ID.
   await send(original);
  }finally{checkingPending=false;}
 }
 function send(d,plan){
  const priorRecord=localStorage.getItem(KEY),separateRecord=localStorage.getItem(SEPARATE);
  const currentOnly=!plan||(plan.input&&!plan.merge);
  const key=plan?.key||KEY,preview={};
  activePreview=preview;
  let submitted;
  const recordSubmission=reviewed=>{
   if(!alive||activePreview!==preview||localStorage.getItem(KEY)!==priorRecord||localStorage.getItem(SEPARATE)!==separateRecord)throw Error('進貨預覽或待核對狀態已變動，請回到表單重新核對。');
   submitted=JSON.stringify({...reviewed,receiptSubmittedAt:new Date().toISOString(),...(plan?.input?{receiptInput:plan.input}:{}),...(plan?.merge?{receiptMerge:true}:{})});
   const owned=!plan?{id:d.id,form:normalReceiptSignature(d.id),pending:JSON.stringify(reviewed)}:null;
   localStorage.setItem(key,submitted);
   activePreview=null;
   if(owned)ownedNormalReceipt=owned;
   showPending();
  };
  const returnToForm=()=>{
   if(!alive||activePreview!==preview)return;
   activePreview=null;
   showPending();draw();
   if(priorRecord!==localStorage.getItem(KEY)||separateRecord!==localStorage.getItem(SEPARATE)){
    pendingStatus('進貨狀態已變動。表單輸入已保留，請先核對同步結果。');
   }else{
    pendingStatus('已返回進貨表單，日期、經手人、各廠牌數量與單價已保留。');
   }
   const input=[...c.querySelectorAll('.receipt-qty')].find(el=>quantities.has(el.dataset.key))||$('#receipt-submit');
   input.focus?.();
  };
  if(directEnabled()){
   return directReview(d,ask,async result=>{
    const receiptEvent={draft:d,lines:result.lines||[],time:result.time};
    if(localStorage.getItem(key)===submitted){
     if(key===SEPARATE)localStorage.removeItem(key);
     else localStorage.setItem(key,JSON.stringify({...d,verified:true,receiptEvent}));
    }
    if(!plan)consumeOwnedNormal(d,d,false);
    else if(plan.input)consumeCurrent(plan.input);
    if(alive){showPending();await load();}
   },plan?pendingStatus:status,{requireUnposted:!!plan,onPreviewError:warnPreview,reviewIntro:reviewed=>reviewed.note?`<p>備註：${esc(reviewed.note)}</p>`:'',receiptRows:()=>rows,beforeCommit:recordSubmission,onReturn:returnToForm,onDiscard:currentOnly?()=>{
    if(!alive||activePreview!==preview||submitted)return;
    ask('<h3>確定放棄本次進貨草稿？</h3><p>放棄後會清除這次填寫的實收內容。</p>',()=>{
     if(!alive||activePreview!==preview||submitted)return;
     if(priorRecord!==localStorage.getItem(KEY)||separateRecord!==localStorage.getItem(SEPARATE)){returnToForm();return;}
     activePreview=null;
     clearCurrent();rows=rows.filter(r=>!r.pendingCreate);draw();status('已放棄本次進貨草稿。');
    },'確認放棄','保留並返回修改',returnToForm);
   }:undefined,onDraftChange:next=>{
    if(!alive||activePreview!==preview)return;
    if(!currentOnly){Object.assign(d,next);return;}
    for(const l of next.lines.filter(l=>l.create)){if(!rows.some(r=>r.name===l.sheet&&r.code===l.code)){const s=sources.find(s=>s.name===l.sheet);if(s)rows.push({...s,code:l.code,drug:l.name,bottles:0,pendingCreate:true,unitPriceCents:l.unitPriceCents});}}
    for(const l of next.lines){
     const key=receiptKey({name:l.sheet,code:l.code,drug:l.name});
     const existing=d.lines.find(old=>old.sheet===l.sheet&&old.code===l.code&&old.name===l.name);
     if(!existing||existing.quantity!==l.quantity)quantities.set(key,String(l.quantity));
     // Quantity edits must keep the exact price input, including its catalog/manual source.
     if(!existing)prices.set(key,l.unitPriceCents===undefined?'':String(l.unitPriceCents/100));
    }
    Object.assign(d,next);
    if(alive){draw();showPending();}
   }});
  }
  const items=d.lines.map(l=>`<li>${esc(l.sheet)}｜${esc(l.name)}：${esc(l.quantity)} 瓶 · 單價 ${l.unitPriceCents===undefined?'未提供':money(l.unitPriceCents)}</li>`).join('');
  ask(`<p>${esc(d.date)} · ${esc(d.actor)}</p><ul>${items}</ul><p>請至 Google 核對庫存並確認入帳。</p>`,async()=>{
   try{
    await navigator.locks.request(KEY,()=>recordSubmission(d));
    const form=document.createElement('form');form.method='POST';form.action=LOSS_ENDPOINT;form.target='_blank';const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=JSON.stringify(d);form.append(input);document.body.append(form);form.submit();form.remove();status('已開啟 Google 核對頁，請以同一交易核對結果。');
   }catch(e){status(e.message);}
  },'開啟 Google 核對頁','返回修改',returnToForm);
 }
 async function reviewWithPrevious(d,prior,separate){
  checkingPending=true;
  processButton.disabled=true;
  $('#receipt-submit').disabled=true;
  pendingStatus('正在查詢上一筆入帳結果…');
  try{
   const previous=cloudDraft(JSON.parse(prior));
   const event=await lookupPostedTransaction(previous);
   if(!alive)return;
   if(prior!==localStorage.getItem(KEY)||separate!==localStorage.getItem(SEPARATE))throw Error('待核對進貨已變動，請重新確認。');
   if(event){
    localStorage.setItem(KEY,JSON.stringify({...event.draft,verified:true,receiptEvent:event}));
    showPending();
    if(sameDraft({...d,id:previous.id},event.draft)){
     pendingStatus('工作表已查到相同內容的進貨。請核對入帳明細，再決定是否另登一批。');
     return;
    }
    pendingStatus('上一筆已入帳，接著預覽本次進貨。');
    await send(d,{key:KEY,prior:localStorage.getItem(KEY),separate,input:d});
    return;
   }
   let combined,mergeError='';
   try{combined=mergeReceipts(previous,d);}catch(e){mergeError=e.message;}
   pendingStatus('');
   const choice=await chooseReceiptMode(previous,d,mergeError,abort.signal);
   if(!alive||!choice)return;
   if(prior!==localStorage.getItem(KEY)||separate!==localStorage.getItem(SEPARATE))throw Error('待核對進貨已變動，請重新確認。');
   if(choice==='previous')await send(previous,{key:KEY,prior,separate});
   if(choice==='current')await send(d,{key:SEPARATE,prior,separate,input:d});
   if(choice==='merge'&&combined)await send(combined,{key:KEY,prior,separate,input:d,merge:true});
  }catch(e){
   if(alive){pendingStatus(e.message);warnPreview(e.message);}
  }finally{
   checkingPending=false;
   if(alive){processButton.disabled=false;summary();}
  }
 }
 function resetPage(){page=1;draw();}
 function turnPage(offset){
  page+=offset;
  draw();
  $('#receipt-page-options').scrollIntoView({block:'start'});
 }
 $('#receipt-prev').onclick=()=>turnPage(-1);
 $('#receipt-next').onclick=()=>turnPage(1);
 $('#receipt-mobile-sort').onchange=e=>{[sort,direction]=e.target.value.split(':');resetPage();};
 $('#receipt-page-size').onchange=e=>{pageSize=Number(e.target.value);resetPage();};
 const selected=()=>{$('#receipt-search').value='';resetPage();if(!loading&&!loadFailed)catalogStatus();};
 $('#receipt-brands').onclick=e=>{const b=e.target.closest('[data-brand]');if(b){brand=b.dataset.brand;selected();}};
 $('#receipt-categories').onclick=e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;selected();}};
 $('#receipt-search').oninput=resetPage;$('#receipt-refresh').onclick=()=>{if(!loading)load(true,{showDialog:true,compact:true});};
 // User edits invalidate earlier-form ownership even if the value is later re-entered identically.
 for(const field of ['#receipt-date','#receipt-actor'])for(const event of ['input','change'])$(field).addEventListener(event,()=>{ownedNormalReceipt=null;});
 $('#receipt-clear').onclick=()=>{ownedNormalReceipt=null;quantities.clear();prices.clear();draw();status('已清除本次輸入，未修改工作表。');};
 c.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort&&direction==='asc'?'desc':'asc';sort=b.dataset.sort;resetPage();});
 $('#receipt-form').addEventListener('invalid',e=>{
  e.preventDefault();
  const field=e.target;
  const label=field.getAttribute('aria-label')||field.closest('label')?.firstChild?.textContent?.trim();
  warnPreview(label?`${label}：${field.validationMessage}`:field.validationMessage,()=>field.focus());
 },true);
 $('#receipt-form').onsubmit=async e=>{
  e.preventDefault();
  if(loading||loadFailed||checkingPending||isProcessing())return;
  try{
   // Inherited prices and stock are always refreshed before building a new receipt.
   if(directEnabled()&&quantities.size){
    await load(false,{showDialog:true,fresh:true});
    if(!alive||loadFailed||loading)return;
   }
   const previousRecord=localStorage.getItem(KEY),separateRecord=localStorage.getItem(SEPARATE);
   const prior=JSON.parse(previousRecord||'null'),separate=JSON.parse(separateRecord||'null');
   if(ownedNormalReceipt&&prior?.id!==ownedNormalReceipt.id&&matchesOwnedNormal(ownedNormalReceipt.id,ownedNormalReceipt)){
    await checkDisplacedReceipt(ownedNormalReceipt,previousRecord,separateRecord);
    return;
   }
   if(prior&&ownedNormalReceipt?.id===prior.id){
    showPending();
    if(prior.verified){
     const cleared=consumeOwnedNormal(prior,prior,true);draw();
     pendingStatus(cleared?'本筆進貨已入帳，請查看入帳明細。':'入帳紀錄與表單內容不同，請先核對交易明細。');
    }else if(directEnabled()){
     await checkPending(true);
    }else pendingStatus('本筆已開啟 Google 核對頁，請先核對同一筆進貨的結果。');
    return;
   }
   if((separate&&!separate.verified)||(prior?.receiptMerge&&!prior.verified)){
    showPending();
    pendingStatus('請先核對已送出的進貨。本次填寫內容已保留。');
    warnPreview('請先核對已送出的進貨。',()=>processButton.focus());
    return;
   }
   if(prior&&!prior.verified){
    showPending();
    if(prior.action==='進貨'){
     await reviewWithPrevious(currentDraft(),previousRecord,separateRecord);
    }else warnPreview('請先查詢上一筆操作結果。',()=>{
     $('#receipt-pending')?.scrollIntoView({block:'center',behavior:'smooth'});
     $('#receipt-check')?.focus({preventScroll:true});
    });
    return;
   }
   const d=currentDraft();
   pendingStatus('');
   await send(d);
  }catch(e){status(e.message);warnPreview(e.message);}
 };
 const stopCatalogWatch=watchSupplierCatalog(load);const sync=()=>{load();};draw();showPending();window.addEventListener('erp-synced',sync);load(false,{showDialog:true}).then(()=>{if(alive)openEntry();});return protectDraft(()=>{alive=false;closeEntry?.();closeCatalogScreen();stopCatalogWatch();ticket++;abort.abort();window.removeEventListener('erp-synced',sync);},()=>quantities.size>0||prices.size>0);
}
