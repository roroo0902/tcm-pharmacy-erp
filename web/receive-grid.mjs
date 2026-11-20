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
import {createSupplierLoader,loadReceiptCatalog,supplierSelection} from './supplier-catalog.mjs?v=receiptread20261119';
import {priceCents,money,pricingTotal} from './receipt-pricing.mjs?v=compact20261030';
import {quantitySteppers} from './quantity-stepper.mjs?v=stepper20261029';
import {directEnabled,directReview,directLog} from './direct-sync.mjs?v=release20261120r1';
import {csvRows,sheetUrl} from './sheets-data.mjs?v=compact20261030';
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
 let ownedNormalReceipt=null;
 let rows=[],sources=[],source=null,brand='',category='',sort='code',direction='asc',alive=true,loading=false,loadFailed=false,ticket=0,pending=null,checkingPending=false;
 let shortageSeeded=false,shortageHandoff=null;const readCatalog=createSupplierLoader(loadReceiptCatalog);
 const status=text=>{if(alive)$('#receipt-state').textContent=text;};
 c.innerHTML=`${supplyLayout}<style>
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
</style><section class="panel"><div class="panelhead"><div><h2>登錄本次進貨</h2><span class="muted">依工作表列出全部品項 · 請填本次實收瓶數，留白不進貨 · 可跨廠牌整批入帳</span></div><a class="secondary" href="#items">＋ 新增品項</a></div><label>廠商</label><div class="order-tabs" id="receipt-brands" role="group" aria-label="進貨廠商"></div><label>類別</label><div class="order-tabs" id="receipt-categories" role="group" aria-label="進貨單方或複方"></div><form id="receipt-form"><div class="grid"><label>進貨日期<input id="receipt-date" type="date" value="${today()}" max="${today()}" required></label><label>經手人<select id="receipt-actor" data-staff required disabled><option value="">正在讀取員工名冊…</option></select></label></div><div class="panelhead receive-tools"><input id="receipt-search" aria-label="搜尋進貨品項" placeholder="搜尋藥品名稱或編號"><button type="button" id="receipt-refresh" class="secondary">同步工作表庫存與單價</button></div><p id="receipt-state" role="status">正在讀取共用廠商與品項…</p><div id="receipt-page-options"><label>每頁顯示<select id="receipt-page-size"><option value="10">10 項</option><option value="20">20 項</option><option value="30">30 項</option></select></label><span id="receipt-page-range" role="status"></span></div><div class="tablewrap"><table id="receipt-grid"><thead><tr><th><button type="button" class="sort-heading" data-sort="code">藥品／編號 ↑</button></th><th>廠牌／類別</th><th class="num"><button type="button" class="sort-heading" data-sort="bottles">未拆封瓶數 ↕</button></th><th class="receipt-quantity"><button type="button" class="sort-heading" data-sort="quantity">本次實收 ↕</button></th><th class="receipt-price-cell">單價（元／瓶）</th><th class="num">進貨小計（元）</th><th class="num">入庫後瓶數</th><th><button type="button" class="sort-heading" data-sort="updated">原表更新欄 ↕</button></th><th>缺藥標記／率</th><th>原表</th></tr></thead><tbody></tbody></table></div><nav id="receipt-pagination" aria-label="藥品清單分頁" hidden><button type="button" class="secondary" id="receipt-prev">上一頁</button><span id="receipt-current-page" role="status"></span><button type="button" class="secondary" id="receipt-next">下一頁</button></nav><div class="actions"><span id="receipt-summary" role="status"></span><button type="button" class="secondary" id="receipt-clear">清除本次輸入</button><span id="receipt-pending-status" role="status"></span><button type="button" id="receipt-process" hidden>處理上一筆進貨</button><button id="receipt-submit" disabled>確認並預覽整批進貨</button></div></form><div id="receipt-pending"></div><p class="muted">先在站內核對各品項原庫存、進貨量與入庫後瓶數，再按「確認入帳」。進貨只增加本次填入數量。按「同步工作表庫存與單價」會以最新 E 欄取代所有本次手動單價，保留已填數量。單價由原表 E 欄帶入；確認入帳後，有填單價的進貨品項會同步更新 E 欄。留白不清除原表價格，0 為零元。金額依輸入單價計算，未另計稅額、折扣或運費。</p></section>`;
 const warnPreview=(message,onReview)=>{
  if(alive&&!isProcessing())showReceiptReviewWarning(message,onReview);
 };
 let page=1,pageSize=10;
 function draw(){
  if(!alive)return;
  const selection=supplierSelection(sources,brand,category);({brand,category,source}=selection);
  $('#receipt-brands').innerHTML=selection.brands.map(b=>`<button type="button" class="secondary ${b===brand?'selected':''}" data-brand="${esc(b)}" aria-pressed="${b===brand}">${esc(b)}</button>`).join('');
  $('#receipt-categories').innerHTML=selection.categories.map(k=>`<button type="button" class="secondary ${k===category?'selected':''}" data-category="${esc(k)}" aria-pressed="${k===category}">${esc(k)}</button>`).join('');
  const query=$('#receipt-search').value.trim().toLowerCase(),list=sortReceiptRows(rows.filter(r=>r.name===source?.name&&`${r.drug} ${r.code}`.toLowerCase().includes(query)),quantities,sort,direction);
  const pageCount=Math.max(1,Math.ceil(list.length/pageSize));
  page=Math.min(page,pageCount);
  const start=(page-1)*pageSize;
  const end=Math.min(start+pageSize,list.length);
  $('#receipt-page-range').textContent=list.length?`顯示第 ${start+1}–${end} 項，共 ${list.length} 項`:'共 0 項';
  $('#receipt-current-page').textContent=`第 ${page} / ${pageCount} 頁`;
  $('#receipt-pagination').hidden=pageCount===1;
  $('#receipt-prev').disabled=page===1;
  $('#receipt-next').disabled=page===pageCount;
  $('#receipt-grid tbody').innerHTML=list.slice(start,end).map(r=>{const reference=shortageHandoff?.records.find(x=>x.sheet===r.name&&x.code===r.code&&x.name===r.drug&&Number.isSafeInteger(x.quantity)&&x.quantity>0);return `<tr data-category="${esc(r.category)}"><td data-label="藥品／編號"><span class="receipt-drug"><span class="receipt-drug-icon" aria-hidden="true"></span><span class="receipt-drug-text"><b>${esc(r.drug)}</b><div class="muted">${esc(r.code)}</div>${r.warning?`<div class="muted">${esc(r.warning)}</div>`:''}</span></span></td><td data-label="廠牌／類別">${esc(r.brand)}<div class="muted">${esc(r.category)}</div></td><td data-label="未拆封瓶數" class="num">${r.bottles===null?'待核對':fmt(r.bottles)+' 瓶'}</td><td data-label="本次實收" class="receipt-quantity"><input class="receipt-qty" data-key="${esc(receiptKey(r))}" aria-label="${esc(r.code)} ${esc(r.drug)} 本次實收瓶數" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="${esc(quantities.get(receiptKey(r))??'')}" placeholder="未進貨">${reference?`<small class="muted">帶入時待到 ${esc(reference.quantity)} 瓶（僅供參考）</small>`:''}</td><td data-label="單價（元／瓶）" class="receipt-price-cell"><span class="receipt-price-control"><input class="receipt-price" data-price-key="${esc(receiptKey(r))}" aria-label="${esc(r.code)} ${esc(r.drug)} 單價" type="number" min="0" max="1000000" step="0.01" inputmode="decimal" value="${esc(receiptPrice(r,prices))}" placeholder="未提供"><span class="receipt-price-unit">元</span></span><small>${esc(prices.has(receiptKey(r))?'本次輸入':r.priceWarning||'')}</small></td><td data-label="進貨小計（元）" class="num receipt-amount" data-amount="${esc(receiptKey(r))}">—</td><td data-label="入庫後瓶數" class="num" data-after="${esc(receiptKey(r))}">—</td><td data-label="原表更新欄">${esc(r.updated||'—')}</td><td data-label="缺藥標記／率">${esc([r.stockout,r.shortage].filter(Boolean).join('／')||'—')}</td><td data-label="原表"><a href="${sheetUrl(r)}" target="_blank" rel="noopener">查看 ↗</a></td></tr>`;}).join('')||'<tr><td colspan="10">沒有符合的品項</td></tr>';
  c.querySelectorAll('[data-sort]').forEach(b=>{const active=b.dataset.sort===sort;b.parentElement.setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');b.textContent=b.textContent.replace(/[↑↓↕]$/,active?(direction==='asc'?'↑':'↓'):'↕');});
  c.querySelectorAll('.receipt-qty').forEach(el=>el.oninput=()=>{if(el.value==='')quantities.delete(el.dataset.key);else quantities.set(el.dataset.key,el.value);summary();});
  c.querySelectorAll('.receipt-price').forEach(el=>el.oninput=()=>{prices.set(el.dataset.priceKey,el.value);el.closest('.receipt-price-cell').querySelector('small').textContent='本次輸入';summary();});
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
 async function load(syncPrices=false,{showDialog=false,compact=true}={}){
  closeCatalogScreen();
  const run=++ticket;loading=true;refreshStatus.start();loadFailed=false;status('正在讀取 '+(brand+category||'共用廠商與品項')+'…');$('#receipt-submit').disabled=true;
  try{if(showDialog&&!isProcessing())catalogScreen=beginProcessing({reading:true,receiptGuild:!compact,receiptCompact:compact,catalogMessage:"正在讀取廠商與品項…"});const data=await readCatalog();if(!alive||run!==ticket)return;reconcileOrderInputs(rows,data.rows,quantities,prices);sources=data.sources;rows=data.rows;if(!shortageSeeded){shortageHandoff=seedShortage('receive',rows,quantities,receiptKey)||null;shortageSeeded=true;}if(syncPrices===true)prices.clear();draw();catalogStatus();}
  catch(e){if(alive&&run===ticket){loadFailed=true;status(e.message+'；已填數量仍保留，請重新讀取工作表重試');}}
  finally{if(alive&&run===ticket){closeCatalogScreen();loading=false;refreshStatus.finish(!loadFailed);summary();$('#receipt-submit').disabled=loadFailed||$('#receipt-submit').disabled;}}
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
  if(owned?.id===original.id)ownedNormalReceipt=null;
  if(!matchesOwnedNormal(original.id,owned))return false;
  try{
   if(JSON.stringify(cloudDraft(original))!==owned.pending)return false;
   if(alreadyPosted&&!sameDraft(posted,original))return false;
   const stored=savedTransaction(KEY);
   if(stored?.verified!==true||stored.id!==original.id||!sameDraft(stored,posted))return false;
  }catch{return false;}
  clearCurrent();
  return true;
 }
 function send(d,plan){
  if(directEnabled()){
   const key=plan?.key||KEY;
   let submitted;
   return directReview(d,ask,async result=>{
    const receiptEvent={draft:d,lines:result.lines||[],time:result.time};
    if(plan?localStorage.getItem(key)===submitted:savedTransaction(key)?.id===d.id){
     if(key===SEPARATE)localStorage.removeItem(key);
     else localStorage.setItem(key,JSON.stringify({...d,verified:true,receiptEvent}));
    }
    if(!plan){ownedNormalReceipt=null;clearCurrent();}
    else if(plan.input)consumeCurrent(plan.input);
    if(alive){showPending();await load();}
   },plan?pendingStatus:status,{requireUnposted:!!plan,onPreviewError:warnPreview,receiptRows:()=>rows,beforeCommit:plan?reviewed=>{
    if(plan.prior!==localStorage.getItem(KEY)||plan.separate!==localStorage.getItem(SEPARATE))throw Error('待核對進貨已變動，請回到進貨登錄重新確認。');
    submitted=JSON.stringify({...reviewed,...(plan.input?{receiptInput:plan.input}:{}),...(plan.merge?{receiptMerge:true}:{})});
    localStorage.setItem(key,submitted);
    showPending();
   }:undefined,onDraftChange:next=>{
    if(plan){Object.assign(d,next);return;}
    const owned=ownedNormalReceipt,current=savedTransaction(KEY);
    let track=false;
    try{track=alive&&matchesOwnedNormal(d.id,owned)&&!current?.verified&&current?.id===d.id&&JSON.stringify(cloudDraft(current))===owned.pending;}catch{}
    if(owned?.id===d.id)ownedNormalReceipt=null;
    for(const l of next.lines.filter(l=>l.create)){if(!rows.some(r=>r.name===l.sheet&&r.code===l.code)){const s=sources.find(s=>s.name===l.sheet);if(s)rows.push({...s,code:l.code,drug:l.name,bottles:0,pendingCreate:true,unitPriceCents:l.unitPriceCents});}}
    Object.assign(d,next);
    if(current?.id===d.id&&!current.verified)localStorage.setItem(KEY,JSON.stringify(d));
    for(const l of d.lines){
     const key=receiptKey({name:l.sheet,code:l.code,drug:l.name});
     quantities.set(key,String(l.quantity));
     prices.set(key,l.unitPriceCents===undefined?'':String(l.unitPriceCents/100));
    }
    if(track)try{ownedNormalReceipt={id:d.id,form:normalReceiptSignature(d.id),pending:JSON.stringify(cloudDraft(d))};}catch{}
    if(alive){draw();showPending();}
   }});
  }
  const form=document.createElement('form');form.method='POST';form.action=LOSS_ENDPOINT;form.target='_blank';const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=JSON.stringify(d);form.append(input);document.body.append(form);form.submit();form.remove();status('已開啟 Google 核對頁，請以同一交易核對結果。');
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
 $('#receipt-page-size').onchange=e=>{pageSize=Number(e.target.value);resetPage();};
 const selected=()=>{$('#receipt-search').value='';resetPage();if(!loading&&!loadFailed)catalogStatus();};
 $('#receipt-brands').onclick=e=>{const b=e.target.closest('[data-brand]');if(b){brand=b.dataset.brand;selected();}};
 $('#receipt-categories').onclick=e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;selected();}};
 $('#receipt-search').oninput=resetPage;$('#receipt-refresh').onclick=()=>{if(!loading)load(true,{showDialog:true,compact:true});};
 $('#receipt-clear').onclick=()=>{quantities.clear();prices.clear();draw();status('已清除本次輸入，未修改工作表。');};
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
   const previousRecord=localStorage.getItem(KEY),separateRecord=localStorage.getItem(SEPARATE);
   const prior=JSON.parse(previousRecord||'null'),separate=JSON.parse(separateRecord||'null');
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
   const owned={id:d.id,form:normalReceiptSignature(d.id),pending:JSON.stringify(d)};
   localStorage.setItem(KEY,owned.pending);
   ownedNormalReceipt=owned;
   showPending();
   send(d);
  }catch(e){status(e.message);warnPreview(e.message);}
 };
 const stopCatalogWatch=watchSupplierCatalog(load);const sync=()=>{load();};draw();showPending();window.addEventListener('erp-synced',sync);load(false,{showDialog:true});return protectDraft(()=>{alive=false;closeCatalogScreen();stopCatalogWatch();ticket++;abort.abort();window.removeEventListener('erp-synced',sync);},()=>quantities.size>0||prices.size>0);
}
