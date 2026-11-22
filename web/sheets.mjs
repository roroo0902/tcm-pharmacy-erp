import {parseSupplierCatalog} from './supplier-catalog.mjs';
import {beginProcessing,isProcessing} from './processing-screen.mjs';
import {exportInventory,filterInventory,selectInventory} from './inventory-export.mjs';
import {money} from './receipt-pricing.mjs';
import {directEnabled,runDirect,directPollMs} from './direct-sync.mjs?v=release20261120r1';
import {sortSheetRows} from './sheets-sort.mjs';
import {SOURCES,parseSheet,sheetUrl,exportUrl} from './sheets-data.mjs?v=stockread20261119';
export function mountSheets({esc,fmt}){
 const content=document.querySelector('#content');let sources=[],brand='',category='',alive=true,busy=false,page=0,statusFilter='all',sortKey='code',sortDirection='asc';const sortYear=Number(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'}).slice(0,4));const controller=new AbortController(),snapshots=new Map(),errors=new Map();
 content.innerHTML=`<style>
#content #cloud-table th:nth-child(-n+2),#content #cloud-table td:nth-child(-n+2){text-align:center;vertical-align:middle}
#content #cloud-table tbody td:first-child{padding-left:54px;padding-right:54px}
#content #cloud-table th:nth-child(-n+2) .sort-heading{text-align:center}
#cloud-cards button.card{display:block;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;min-width:0;background:#fffdf5}
#cloud-cards [data-cloud-filter="warning"]::after{background-image:url("./web/assets/checklist-scroll.png");opacity:1;image-rendering:pixelated}
#cloud-cards [data-cloud-filter="zero"]::after{background-image:url("./web/assets/empty-treasure-chest.png");width:56px;height:56px;filter:none;opacity:1;image-rendering:pixelated}
#cloud-cards button.card:hover{background:#f8f0da;border-color:#8a6a2d}
#cloud-cards button.card[aria-pressed="true"]{border-color:#315e81;box-shadow:inset 0 0 0 2px #315e81,0 3px 0 #d8dccf}
#cloud-cards button.card:focus-visible{outline:3px solid #315e81;outline-offset:4px}
#cloud-cards .card-hint{display:block;font-size:12px;margin-top:8px;color:#405c73}

#cloud-brands .cloud-all-wrap,#cloud-categories .cloud-all-wrap{display:inline-flex;padding-right:14px;margin-right:6px;border-right:1px solid #b49a60}
#cloud-brands .cloud-all,#cloud-categories .cloud-all{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:108px;min-height:44px;background:#f3e4b7;color:#183b56;border:1px solid #b39448;box-shadow:0 3px 0 #b6a16b;font-weight:600}
#cloud-brands .cloud-all::before,#cloud-categories .cloud-all::before{content:none}
#cloud-brands .cloud-all[aria-pressed="true"],#cloud-categories .cloud-all[aria-pressed="true"]{background:linear-gradient(135deg,#ead18a,#d5b45d);border-color:#96732d;box-shadow:inset 0 0 0 2px #f4e4ac,0 3px 0 #88703c;color:#173b56}
#cloud-brands .cloud-all:hover,#cloud-categories .cloud-all:hover{background:#e8cc80}
#cloud-brands .cloud-all:focus-visible,#cloud-categories .cloud-all:focus-visible{outline:3px solid #315e81;outline-offset:4px}
.cloud-all-icon{display:inline-grid;grid-template-columns:repeat(2,6px);gap:2px;flex:none}.cloud-all-icon i{width:6px;height:6px;background:currentColor;border-radius:1px}
.cloud-all-check{width:14px;height:14px;visibility:hidden;flex:none}.cloud-all[aria-pressed="true"] .cloud-all-check{visibility:visible}
.cloud-selector-label{display:block;margin-top:14px;margin-bottom:6px}
#cloud-details{scroll-margin-top:16px}#cloud-detail-title:focus{outline:2px solid #315e81;outline-offset:4px}
</style><section class="panel"><div class="panelhead"><div><h2>Google Sheets 藥庫總表</h2><p class="muted">依廠牌與單複方分類 · 僅查詢，不寫入試算表</p></div><button id="cloud-refresh">立即同步 ↻</button></div><div id="cloud-status" role="status" aria-live="polite">正在讀取 Google Sheets…</div><p class="muted">開啟此頁時讀取，停留頁面每 ${directEnabled()?directPollMs()/1000:60} 秒重新讀取。原表更新欄僅有月／日者照原樣顯示；同步時間不代表實際盤點時間。單價取自原表 E 欄；庫存以原表 G 欄「未拆封」瓶數為準。</p><div class="toolbar cloud-filters"><input id="cloud-search" aria-label="搜尋雲端藥品" placeholder="搜尋藥名或編號"></div><span class="cloud-selector-label">廠商</span><div id="cloud-brands" class="order-tabs" role="group" aria-label="廠商"></div><span class="cloud-selector-label">類別</span><div id="cloud-categories" class="order-tabs" role="group" aria-label="類別"></div></section><div class="cards" id="cloud-cards"></div><section class="panel" id="cloud-details"><div class="panelhead"><h2 id="cloud-detail-title" tabindex="-1"></h2><button id="cloud-export" class="secondary" disabled>匯出目前篩選結果</button></div><p id="cloud-export-status" role="status"></p><p class="muted">點選上方統計卡可切換明細，保留搜尋、廠牌與單複方條件。點選欄位標題可切換升冪／降冪；完整日期依年月日排序；只有月／日者以今年（${sortYear} 年）排序。空白或無效值固定置底。</p><div id="cloud-table"></div><div class="actions"><button class="secondary" id="cloud-prev">上一頁</button><span class="muted" id="cloud-page"></span><button class="secondary" id="cloud-next">下一頁</button></div></section><section class="panel"><h2>來源與同步狀態</h2><div id="cloud-sources"></div><p class="muted">查詢內容直接從 Google 讀取，不寫入公開 GitHub 程式庫或單機帳本。${directEnabled()?'請先登入獲准使用藥庫的 Google 帳號。':'若原表停止公開分享，此查詢會停止，需另設登入授權。'}</p></section>`;
 const $=s=>content.querySelector(s),time=t=>new Date(t).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
 function heading(key,label,second){return `<th aria-sort="${(sortKey===key||sortKey===second?.[0])?(sortDirection==='asc'?'ascending':'descending'):'none'}"><button class="sort-heading" data-sort="${key}" aria-label="依${label}排序">${label} ${sortKey===key?(sortDirection==='asc'?'↑':'↓'):'↕'}</button>${second?'<br><button class="sort-heading" data-sort="'+second[0]+'" aria-label="依'+second[1]+'排序">'+second[1]+' '+(sortKey===second[0]?(sortDirection==='asc'?'↑':'↓'):'↕')+'</button>':''}</th>`;}
 function filterButton(value,selected,key){
 const all=value==='';
 const icon='<span class="cloud-all-icon" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
 const check='<svg class="cloud-all-check" aria-hidden="true" viewBox="0 0 16 16"><path d="M2 8l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const button=`<button type="button" class="secondary ${all?'cloud-all ':''}${value===selected?'selected':''}" data-${key}="${esc(value)}" aria-pressed="${value===selected}">${all?icon:''}${esc(value||'全部')}${all?check:''}</button>`;
 return all?'<span class="cloud-all-wrap">'+button+'</span>':button;
 }
 function draw(){if(!alive)return;
 const brands=[...new Set(sources.map(s=>s.brand))];
 if(brand&&!brands.includes(brand))brand='';
 const categories=[...new Set(sources.filter(s=>!brand||s.brand===brand).map(s=>s.category))];
 if(category&&!categories.includes(category))category='';
 const selection={brands:['',...brands],categories:['',...categories]};
 $('#cloud-brands').innerHTML=selection.brands.map(b=>filterButton(b,brand,'brand')).join('');
 $('#cloud-categories').innerHTML=selection.categories.map(c=>filterButton(c,category,'category')).join('');
 const all=sources.flatMap(s=>snapshots.get(s.gid)?.rows??[]);const q=$('#cloud-search').value.toLowerCase();const filters={q,brand,category,status:statusFilter,sortKey,sortDirection,sortYear};const matching=filterInventory(all,filters),list=selectInventory(all,filters);const exportReady=!busy&&!errors.size&&snapshots.size===sources.length&&list.length>0;$('#cloud-export').disabled=!exportReady;$('#cloud-export-status').textContent=busy?'正在同步，完成後即可匯出。':errors.size||snapshots.size!==sources.length?'來源尚未完整同步，請同步成功後再匯出。':!list.length?'目前沒有符合條件的品項。':'匯出目前條件的全部品項（含其他頁），依目前排序排列。';$('#cloud-export').onclick=()=>{if(!exportReady||busy)return;try{const file=exportInventory(all,filters,[...snapshots].map(([gid,v])=>({name:sources.find(s=>s.gid===gid).name,time:v.time})));const url=URL.createObjectURL(new Blob([file.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=file.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#cloud-export-status').textContent='已產生 '+file.count+' 筆品項的 Excel，請確認瀏覽器下載完成。';}catch(e){$('#cloud-export-status').textContent=e.message;}};const pages=Math.max(1,Math.ceil(list.length/50));page=Math.min(page,pages-1);$('#cloud-prev').disabled=page===0;$('#cloud-next').disabled=page===pages-1;$('#cloud-page').textContent=`第 ${page+1} / ${pages} 頁 · ${list.length} 筆`;
 const labels={all:'符合品項',zero:'零庫存',warning:'待核對'};
 $('#cloud-detail-title').textContent=labels[statusFilter]+'明細 · '+list.length+' 筆';
 const focusedCard=document.activeElement?.dataset?.cloudFilter;
 $('#cloud-cards').innerHTML=[['符合品項',matching.length,'筆','all'],['已填瓶數合計',matching.reduce((s,r)=>s+(r.bottles??0),0),'瓶 · 依搜尋與廠牌條件',null],['零庫存',matching.filter(r=>r.bottles===0).length,'筆','zero'],['待核對',matching.filter(r=>r.warning).length,'筆','warning']].map(([label,n,unit,key])=>{const body=`<small>${label}</small><strong>${snapshots.size?fmt(n):'—'}</strong><em>${unit}</em>`;return key?`<button type="button" class="card" data-cloud-filter="${key}" aria-pressed="${statusFilter===key}" aria-controls="cloud-table">${body}<span class="card-hint">${statusFilter===key?'目前顯示':'點選查看明細 ↓'}</span></button>`:`<div class="card">${body}</div>`;}).join('');
 content.querySelectorAll('[data-cloud-filter]').forEach(button=>button.onclick=()=>{statusFilter=button.dataset.cloudFilter;page=0;draw();$('#cloud-detail-title').focus({preventScroll:true});$('#cloud-details').scrollIntoView({block:'start'});});
 if(focusedCard)content.querySelector('[data-cloud-filter="'+focusedCard+'"]').focus({preventScroll:true});
 $('#cloud-table').innerHTML=list.length?`<div class="tablewrap"><table><thead><tr>${heading('code','編號',['drug','藥品名稱'])}${heading('brand','廠牌／類別')}${heading('price','單價（元／瓶）')}${heading('bottles','未拆封瓶數')}${heading('updated','原表更新欄')}${heading('stockout','缺藥標記',['shortage','缺藥率'])}${heading('warning','核對事項')}<th>原表</th></tr></thead><tbody>${list.slice(page*50,page*50+50).map(r=>`<tr data-category="${esc(r.category)}"><td><b>${esc(r.drug)}</b><div class="muted">${esc(r.code||'未填編號')}</div></td><td>${esc(r.brand)}<div class="muted">${esc(r.category)}</div></td><td class="num">${r.unitPriceCents!==undefined?esc(money(r.unitPriceCents)):r.priceWarning?esc(r.priceRaw)+'（待核對）':'未填'}</td><td class="num"><b>${r.stockRaw===''?'未填':esc(r.stockRaw)}</b>${r.bottles!==null?' 瓶':''}</td><td>${esc(r.updated||'未填')}</td><td>${esc([r.stockout,r.shortage].filter(Boolean).join('／')||'—')}</td><td>${r.warning?`<span class="pill warn">${esc(r.warning)}</span>`:'—'}${errors.has(r.gid)?'<div class="pill out">舊資料・同步失敗</div>':''}</td><td><a href="${sheetUrl(r)}&range=B${r.row}:M${r.row}" target="_blank" rel="noopener">查看 ↗</a></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">${busy?'正在讀取…':errors.size===sources.length?'目前無法取得來源資料，請稍後重新同步。':'沒有符合的藥品。'}</div>`;
 content.querySelectorAll('[data-sort]').forEach(button=>button.onclick=()=>{const key=button.dataset.sort;sortDirection=key===sortKey&&sortDirection==='asc'?'desc':'asc';sortKey=key;page=0;draw();content.querySelector('[data-sort="'+key+'"]').focus();});
 $('#cloud-sources').innerHTML=sources.map(s=>`<p><a href="${sheetUrl(s)}" target="_blank" rel="noopener">${s.name} ↗</a>　<span class="muted">${snapshots.has(s.gid)?snapshots.get(s.gid).rows.length+' 筆 · '+time(snapshots.get(s.gid).time):'尚未讀取'}</span>${errors.has(s.gid)?` <span class="pill out">${esc(errors.get(s.gid))}</span>`:''}</p>`).join('');
 }
 let loadingScreen;
 async function sync({showDialog=false}={}){if(busy||!alive)return;busy=true;$('#cloud-export').disabled=true;$('#cloud-export-status').textContent='正在同步，完成後即可匯出。';$('#cloud-refresh').disabled=true;$('#cloud-status').textContent='正在向 Google 讀取最新內容…';try{if(showDialog&&!isProcessing())loadingScreen=beginProcessing({reading:true,compact:true,readOnly:true,inventorySync:true,catalogMessage:'正在從 Google Sheets 讀取最新庫存。'});const snapshot=directEnabled()?await runDirect('readOrderCatalog',{receipt:true}):null;
 if(snapshot){parseSupplierCatalog(snapshot);sources=snapshot.sources;}else sources=SOURCES;
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
 $('#cloud-brands').onclick=e=>{const b=e.target.closest('[data-brand]');if(b){brand=b.dataset.brand;page=0;draw();}};
 $('#cloud-categories').onclick=e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;page=0;draw();}};$('#cloud-prev').onclick=()=>{page--;draw();};$('#cloud-next').onclick=()=>{page++;draw();};$('#cloud-refresh').onclick=()=>sync({showDialog:true});
 const onVisible=()=>{if(!document.hidden)sync();};document.addEventListener('visibilitychange',onVisible);const timer=setInterval(()=>{if(!document.hidden)sync();},directEnabled()?directPollMs():60000);window.addEventListener('erp-synced',sync);draw();sync({showDialog:true});return()=>{alive=false;loadingScreen?.close();loadingScreen=null;window.removeEventListener('erp-synced',sync);controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
}

