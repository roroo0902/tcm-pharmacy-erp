import {stockFilterStyles,filterHeading,sign,categoryButton,icon,tick} from './stock-filters.mjs';
import {supplierCache} from './recent-read.mjs';
import {beginProcessing,isProcessing} from './processing-screen.mjs';
import {exportInventory,filterInventory,selectInventory,inventoryLabels} from './inventory-export.mjs?v=overviewCards1';
import {money} from './receipt-pricing.mjs';
import {directEnabled,runDirect,directPollMs} from './direct-sync.mjs?v=release20261120r1';
import {sortSheetRows} from './sheets-sort.mjs';
import {SOURCES,parseSheet,sheetUrl,exportUrl} from './sheets-data.mjs?v=stockread20261119';
export function mountSheets({esc,fmt}){
 const content=document.querySelector('#content');let sources=[],brand='',category='',alive=true,busy=false,page=0,statusFilter='all',sortKey='code',sortDirection='asc';const sortYear=Number(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'}).slice(0,4));const controller=new AbortController(),snapshots=new Map(),errors=new Map();
 let registry=[],lastBrands='',lastCategories='';
 content.innerHTML=`${stockFilterStyles}<style>
#content #cloud-table th:nth-child(-n+2),#content #cloud-table td:nth-child(-n+2){text-align:center;vertical-align:middle}
#content #cloud-table tbody td:first-child{padding-left:54px;padding-right:54px}
#content #cloud-table th:nth-child(-n+2) .sort-heading{text-align:center}
.stock-heading{min-width:0}
.stock-heading h2{
 display:inline-flex;align-items:center;gap:9px;margin:0;padding:3px 12px 3px 8px;
 border:4px double #dcba67;border-radius:6px;background:#18344c;color:#fff6dc;line-height:1.25;
 clip-path:polygon(5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px),0 5px)
}
.stock-heading h2::before{content:none}
.stock-heading h2 img{width:26px;height:35px;object-fit:contain;flex:none}
.stock-heading p{margin:5px 0 0}
.stock-heading #cloud-total{font-weight:700;color:#214563}
@media(min-width:951px){#cloud-brands-label,#cloud-categories-label{width:77%}}
#cloud-cards{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
#cloud-cards button.card{width:100%;min-width:0;min-height:112px;display:flex;align-items:center;justify-content:center;gap:clamp(7px,1vw,16px);padding:18px 12px;text-align:left;background:#fffdf5;border:1px solid #c6a362;color:#173650;font:inherit;cursor:pointer}
#cloud-cards button.card img{width:clamp(50px,5vw,86px);height:70px;object-fit:contain;flex:none}
#cloud-cards .metric-copy{border-inline-start:1px solid #bca575;padding-inline-start:clamp(7px,1vw,16px);min-width:0}
#cloud-cards .metric-copy small{display:block;font-size:clamp(.9rem,1.1vw,1.16rem);font-weight:700;color:inherit;letter-spacing:0}
#cloud-cards .metric-copy strong{margin:2px 0 0;color:inherit;font-size:clamp(1.55rem,2.25vw,2.3rem);overflow-wrap:anywhere}
#cloud-cards .metric-copy em{display:inline;color:inherit;font:600 .85rem/1 system-ui;margin-inline-start:4px}
#cloud-cards button.card::after{content:none}
#cloud-cards button.card:hover{background:#f7f0df}
#cloud-cards button.card[aria-pressed=true]{background:#142f49;color:white;border-color:#a88036;box-shadow:inset 0 0 0 3px #edc56d}
#cloud-cards button.card[aria-pressed=true]::after{content:'✓';position:absolute;top:5px;right:5px;width:18px;height:18px;display:grid;place-items:center;background:#ffda85;color:#142f49;border-radius:50%;font:bold 14px/1 sans-serif;opacity:1;filter:none}
#cloud-cards button.card:focus-visible{outline:3px solid #a88036;outline-offset:3px}
@media(max-width:1100px){#cloud-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){#cloud-cards{gap:8px}#cloud-cards button.card{min-height:94px;padding:16px 8px;gap:5px}#cloud-cards button.card img{width:38px;height:44px}#cloud-cards .metric-copy{padding-inline-start:6px}}
#cloud-details{scroll-margin-top:16px}#cloud-detail-title:focus{outline:2px solid #315e81;outline-offset:4px}
</style><section class="panel"><div class="panelhead"><div class="stock-heading"><h2><img src="./web/assets/inventory-clipboard.webp" width="26" height="35" alt="">藥庫存量總覽</h2><p id="cloud-total"></p><p class="muted">翻開藥庫盤點板，依廠商、類別或藥名查看未拆封庫存。</p></div><button id="cloud-refresh">立即同步 ↻</button></div><div id="cloud-status" role="status" aria-live="polite">正在讀取 Google Sheets…</div><p class="muted">開啟此頁時讀取，停留頁面每 ${directEnabled()?directPollMs()/1000:60} 秒重新讀取。原表更新欄僅有月／日者照原樣顯示；同步時間不代表實際盤點時間。單價取自原表 E 欄；庫存以原表 G 欄「未拆封」瓶數為準。</p><div class="toolbar cloud-filters"><input id="cloud-search" aria-label="搜尋雲端藥品" placeholder="搜尋藥名或編號"></div>${filterHeading('廠商','cloud-brands-label')}<div id="cloud-brands" class="order-tabs stock-filter-tabs" role="group" aria-labelledby="cloud-brands-label"></div>${filterHeading('類別','cloud-categories-label')}<div id="cloud-categories" class="order-tabs stock-filter-tabs" role="group" aria-labelledby="cloud-categories-label"></div></section><div class="cards" id="cloud-cards"></div><section class="panel" id="cloud-details"><div class="panelhead"><h2 id="cloud-detail-title" tabindex="-1"></h2><button id="cloud-export" class="secondary" disabled>匯出目前篩選結果</button></div><p id="cloud-export-status" role="status"></p><p class="muted">點選上方統計卡可切換明細，保留搜尋、廠商與類別條件。點選欄位標題可切換升冪／降冪；完整日期依年月日排序；只有月／日者以今年（${sortYear} 年）排序。空白或無效值固定置底。</p><div id="cloud-table"></div><div class="actions"><button class="secondary" id="cloud-prev">上一頁</button><span class="muted" id="cloud-page"></span><button class="secondary" id="cloud-next">下一頁</button></div></section><section class="panel"><h2>來源與同步狀態</h2><div id="cloud-sources"></div><p class="muted">查詢內容直接從 Google 讀取，不寫入公開 GitHub 程式庫或單機帳本。${directEnabled()?'請先登入獲准使用藥庫的 Google 帳號。':'若原表停止公開分享，此查詢會停止，需另設登入授權。'}</p></section>`;
 const $=s=>content.querySelector(s),time=t=>new Date(t).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
 function heading(key,label,second){return `<th aria-sort="${(sortKey===key||sortKey===second?.[0])?(sortDirection==='asc'?'ascending':'descending'):'none'}"><button class="sort-heading" data-sort="${key}" aria-label="依${label}排序">${label} ${sortKey===key?(sortDirection==='asc'?'↑':'↓'):'↕'}</button>${second?'<br><button class="sort-heading" data-sort="'+second[0]+'" aria-label="依'+second[1]+'排序">'+second[1]+' '+(sortKey===second[0]?(sortDirection==='asc'?'↑':'↓'):'↕')+'</button>':''}</th>`;}
 const quick=['單方','複方'];
 function drawFilters(brands,categories){
  const group=$('#cloud-categories');
  const brandBar=$('#cloud-brands');
  const vendorMarkup=['',...brands].map(b=>sign(b,brand,'brand',esc)).join('');
  const extras=[...new Set(registry.filter(s=>!brand||s.brand===brand).map(s=>s.category).concat(categories))].filter(c=>c&&!quick.includes(c));
  const selectedExtra=extras.includes(category);
  const name=selectedExtra?category:'更多類別';
  const choices=extras.map(c=>categoryButton(c,category,esc,categories.includes(c))).join('');
  const menu=`<div class="stock-more"><button type="button" class="stock-tool ${selectedExtra?'is-active':''}" id="stock-more" aria-expanded="false" aria-controls="stock-options">${icon(name)}<span class="stock-label">${esc(name)}</span><span class="stock-trailing" aria-hidden="true">${selectedExtra?tick:''}▾</span></button><div id="stock-options" class="stock-options" hidden>${choices||'<p>此廠商沒有其他類別</p>'}</div></div>`;
  const categoryMarkup=sign('',category,'category',esc)+quick.filter(c=>categories.includes(c)).map(c=>categoryButton(c,category,esc)).join('')+menu;
  if(vendorMarkup!==lastBrands){brandBar.innerHTML=vendorMarkup;lastBrands=vendorMarkup;}
  if(categoryMarkup!==lastCategories){group.innerHTML=categoryMarkup;lastCategories=categoryMarkup;}
 }
 function toggleMore(open){
  const trigger=$('#stock-more'),options=$('#stock-options');
  if(!trigger||!options)return;
  trigger.setAttribute('aria-expanded',String(open));options.hidden=!open;
 }
 function draw(){if(!alive)return;
 const brands=[...new Set(sources.map(s=>s.brand))];
 if(brand&&!brands.includes(brand))brand='';
 const categories=[...new Set(sources.filter(s=>!brand||s.brand===brand).map(s=>s.category))];
 if(category&&!categories.includes(category))category='';
 drawFilters(brands,categories);
 const all=sources.flatMap(s=>snapshots.get(s.gid)?.rows??[]);const q=$('#cloud-search').value.toLowerCase();const filters={q,brand,category,status:statusFilter,sortKey,sortDirection,sortYear};const matching=filterInventory(all,filters),list=selectInventory(all,filters);const exportReady=!busy&&!errors.size&&snapshots.size===sources.length&&list.length>0;$('#cloud-export').disabled=!exportReady;$('#cloud-export-status').textContent=busy?'正在同步，完成後即可匯出。':errors.size||snapshots.size!==sources.length?'來源尚未完整同步，請同步成功後再匯出。':!list.length?'目前沒有符合條件的品項。':'匯出目前條件的全部品項（含其他頁），依目前排序排列。';$('#cloud-export').onclick=()=>{if(!exportReady||busy)return;try{const file=exportInventory(all,filters,[...snapshots].map(([gid,v])=>({name:sources.find(s=>s.gid===gid).name,time:v.time})));const url=URL.createObjectURL(new Blob([file.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=file.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#cloud-export-status').textContent='已產生 '+file.count+' 筆品項的 Excel，請確認瀏覽器下載完成。';}catch(e){$('#cloud-export-status').textContent=e.message;}};const pages=Math.max(1,Math.ceil(list.length/50));page=Math.min(page,pages-1);$('#cloud-prev').disabled=page===0;$('#cloud-next').disabled=page===pages-1;$('#cloud-page').textContent=`第 ${page+1} / ${pages} 頁 · ${list.length} 筆`;
 $('#cloud-detail-title').textContent=inventoryLabels[statusFilter]+'明細 · '+list.length+' 筆';
 const focusedCard=document.activeElement?.dataset?.cloudFilter;
 const bottleTotal=matching.reduce((sum,row)=>sum+(row.bottles??0),0);
 const scope=brand||category||q?'篩選結果':'全藥庫';
 const known=matching.filter(row=>row.bottles!==null).length;
 const bottleLabel=matching.length&&!known?'未拆封瓶數待核對':('未拆封'+(known<matching.length?'已填小計':'合計')+' '+fmt(bottleTotal)+' 瓶');
 $('#cloud-total').textContent=snapshots.size
  ? (errors.size?'部分資料待同步 · ':'')+scope+'共 '+fmt(matching.length)+' 項藥品 · '+bottleLabel
  : (errors.size?'庫存資料尚未取得':'正在讀取品項與瓶數…');
 const metrics=[
  ['all', matching.length, '筆'],
  ['filled', bottleTotal, '瓶'],
  ['zero', matching.filter(row=>row.bottles===0).length, '筆'],
  ['warning', matching.filter(row=>row.warning).length, '筆']
 ];
 $('#cloud-cards').innerHTML=metrics.map(([key,count,unit])=>`<button type="button" class="card" data-cloud-filter="${key}" aria-pressed="${statusFilter===key}" aria-controls="cloud-table">
  <img src="./web/assets/inventory-card-${key}.png" alt="">
  <span class="metric-copy"><small>${inventoryLabels[key]}</small><strong>${snapshots.size?fmt(count):'—'}<em>${unit}</em></strong></span>
 </button>`).join('');
 content.querySelectorAll('[data-cloud-filter]').forEach(button=>button.onclick=()=>{
  statusFilter=button.dataset.cloudFilter;page=0;draw();
  content.querySelector('[data-cloud-filter="'+statusFilter+'"]').focus({preventScroll:true});
 });
 if(focusedCard)content.querySelector('[data-cloud-filter="'+focusedCard+'"]').focus({preventScroll:true});
 $('#cloud-table').innerHTML=list.length?`<div class="tablewrap"><table><thead><tr>${heading('code','編號',['drug','藥品名稱'])}${heading('brand','廠牌／類別')}${heading('price','單價（元／瓶）')}${heading('bottles','未拆封瓶數')}${heading('updated','原表更新欄')}${heading('stockout','缺藥標記',['shortage','缺藥率'])}${heading('warning','核對事項')}<th>原表</th></tr></thead><tbody>${list.slice(page*50,page*50+50).map(r=>`<tr data-category="${esc(r.category)}"><td><b>${esc(r.drug)}</b><div class="muted">${esc(r.code||'未填編號')}</div></td><td>${esc(r.brand)}<div class="muted">${esc(r.category)}</div></td><td class="num">${r.unitPriceCents!==undefined?esc(money(r.unitPriceCents)):r.priceWarning?esc(r.priceRaw)+'（待核對）':'未填'}</td><td class="num"><b>${r.stockRaw===''?'未填':esc(r.stockRaw)}</b>${r.bottles!==null?' 瓶':''}</td><td>${esc(r.updated||'未填')}</td><td>${esc([r.stockout,r.shortage].filter(Boolean).join('／')||'—')}</td><td>${r.warning?`<span class="pill warn">${esc(r.warning)}</span>`:'—'}${errors.has(r.gid)?'<div class="pill out">舊資料・同步失敗</div>':''}</td><td><a href="${sheetUrl(r)}&range=B${r.row}:M${r.row}" target="_blank" rel="noopener">查看 ↗</a></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">${busy?'正在讀取…':errors.size===sources.length?'目前無法取得來源資料，請稍後重新同步。':'沒有符合的藥品。'}</div>`;
 content.querySelectorAll('[data-sort]').forEach(button=>button.onclick=()=>{const key=button.dataset.sort;sortDirection=key===sortKey&&sortDirection==='asc'?'desc':'asc';sortKey=key;page=0;draw();content.querySelector('[data-sort="'+key+'"]').focus();});
 $('#cloud-sources').innerHTML=sources.map(s=>`<p><a href="${sheetUrl(s)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>　<span class="muted">${snapshots.has(s.gid)?snapshots.get(s.gid).rows.length+' 筆 · '+time(snapshots.get(s.gid).time):'尚未讀取'}</span>${errors.has(s.gid)?` <span class="pill out">${esc(errors.get(s.gid))}</span>`:''}</p>`).join('');
 }
 let loadingScreen;
 function showSyncDialog(){
  if(!loadingScreen&&!isProcessing())loadingScreen=beginProcessing({reading:true,compact:true,readOnly:true,inventorySync:true,catalogMessage:'正在從 Google Sheets 讀取最新庫存。'});
 }
 function onSynced(event){
  if(!event.detail?.connected) return sync();
  if(busy) return showSyncDialog();
  return sync({showDialog:true});
 }
 async function sync({showDialog=false}={}){if(busy||!alive)return;busy=true;$('#cloud-export').disabled=true;$('#cloud-export-status').textContent='正在同步，完成後即可匯出。';$('#cloud-refresh').disabled=true;$('#cloud-status').textContent='正在向 Google 讀取最新內容…';try{if(showDialog)showSyncDialog();const snapshot=directEnabled()?await runDirect('readOverviewCatalog'):null;
 if(snapshot){sources=snapshot.sources;registry=snapshot.registry??sources;}else {sources=SOURCES;registry=sources;}
 for(const gid of snapshots.keys())if(!sources.some(s=>s.gid===gid))snapshots.delete(gid);
 errors.clear();
 await Promise.all(sources.map(async s=>{try{
  let rows;
  if(snapshot){
   const values=snapshot.sheets[s.name];
   if(!values)throw Error('來源缺少 '+s.name);
   rows=parseSheet(values,s);
  }else{
   const response=await fetch(exportUrl(s),{credentials:'omit',cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});
   if(!response.ok)throw Error('Google 回應 '+response.status);
   if(!response.headers.get('content-type')?.includes('text/csv'))throw Error('來源需要登入或未提供資料');
   rows=parseSheet(await response.text(),s);
  }
  if(!alive)return;snapshots.set(s.gid,{rows,time:Date.now()});errors.delete(s.gid);}catch(e){if(alive)errors.set(s.gid,e.name==='TimeoutError'?'讀取逾時':e.message==='Failed to fetch'?'連線或分享權限有變，請重試':e.message);}}));}catch(e){errors.set('catalog',e.message);}finally{loadingScreen?.close();loadingScreen=null;busy=false;if(alive){$('#cloud-refresh').disabled=false;$('#cloud-status').textContent=errors.has('catalog')?'廠商設定讀取失敗：'+errors.get('catalog')+'；保留上次資料，請重新同步。':errors.size?`有 ${errors.size} 個分頁同步失敗；成功分頁已更新，舊資料已標示。`:`已同步 ${sources.length} 個分頁 · ${time(Date.now())}`;draw();}}}
 $('#cloud-search').oninput=()=>{page=0;draw();};
 $('#cloud-brands').onclick=e=>{
  const button=e.target.closest('[data-brand]');if(!button)return;
  brand=button.dataset.brand;page=0;toggleMore(false);draw();
  [...$('#cloud-brands').children].find(b=>b.dataset.brand===brand)?.focus({preventScroll:true});
 };
 $('#cloud-categories').onclick=e=>{
  const trigger=e.target.closest('#stock-more');
  if(trigger){toggleMore(trigger.getAttribute('aria-expanded')!=='true');return;}
  const button=e.target.closest('[data-category]');if(!button||button.disabled)return;
  category=button.dataset.category;page=0;toggleMore(false);draw();
  const target=quick.includes(category)||!category?[...$('#cloud-categories').children].find(b=>b.dataset.category===category):$('#stock-more');
  target?.focus({preventScroll:true});
 };
 document.addEventListener('click',e=>{if(!e.target.closest('.stock-more'))toggleMore(false);},{signal:controller.signal});
 $('#cloud-categories').onkeydown=e=>{if(e.key==='Escape'&&!$('#stock-options').hidden){toggleMore(false);$('#stock-more').focus();}};
 $('#cloud-prev').onclick=()=>{page--;draw();};$('#cloud-next').onclick=()=>{page++;draw();};$('#cloud-refresh').onclick=()=>{supplierCache.clear();return sync({showDialog:true});};
 const onVisible=()=>{if(!document.hidden)sync();};document.addEventListener('visibilitychange',onVisible);const timer=setInterval(()=>{if(!document.hidden)sync();},directEnabled()?directPollMs():60000);window.addEventListener('erp-synced',onSynced);draw();sync({showDialog:true});return()=>{alive=false;loadingScreen?.close();loadingScreen=null;window.removeEventListener('erp-synced',onSynced);controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
}

