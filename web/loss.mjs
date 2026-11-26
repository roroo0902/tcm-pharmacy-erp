import {lossSlips,lossSheets,showLossSlips} from './loss-pending-list.mjs';
import {lossPage} from './loss-pagination.mjs';
import {lossReasons} from './loss-reasons.mjs';
import {protectDraft} from './page-safety.mjs';
import {createLossResultCheck,showLossCheckResult} from './loss-result-check.mjs';
import {alignOrderWord} from './order-word-axis.mjs';
import {isProcessing,beginProcessing} from './processing-screen.mjs';
import {lossCancellationSummary} from './loss-cancel.mjs';
import {createRefreshStatus} from './refresh-status.mjs';
import {lossCompletionMarkup,mountLossCompletion} from './loss-completion.mjs?v=dailylossread20261119';
import {lossLayout} from './loss-layout.mjs';
import {operationResult} from './operation-result.mjs';
import {verifiedLossCatalog,lossCalculation,createLossLoader,readLossWithTimeout} from './loss-readback.mjs?v=googlesync20261114';
import {watchSupplierCatalog} from './catalog-events.mjs';
import {supplierSelection} from './supplier-catalog.mjs?v=googlesync20261114';
import {quantitySteppers} from './quantity-stepper.mjs?v=stepper20261029';
import {runDirect,directEnabled,directReview} from './direct-sync.mjs?v=release20261120r1';
import {sheetUrl} from './sheets-data.mjs?v=compact20261030';
import {sortSheetRows} from './sheets-sort.mjs?v=postedloss20261114';
import {today} from './store.mjs';
import {LOSS_ENDPOINT,LOSS_SHEET,lossPostedRows,lossDraft,lossCorrectionReason} from './loss-cloud.mjs?v=lossrevision20261120';
const RESULT_KEY='tcm-loss-result-v1',HIDDEN_RESULT='tcm-loss-hidden-result-v1';
export function mountLoss({esc,fmt,ask,message}){
 const $=s=>document.querySelector(s),cache=new Map(),drafts=new Map();let rowById=new Map(),completionBySheet=null,sources=[],selected=null,brand='',category='',loading=false,loadFailed=false,sort='code',direction='asc',page=1,pageSize=10,disposed=false,generation=0,date=today(),pending=null,reuseResultId='';
 const draftFor=day=>{if(!drafts.has(day))drafts.set(day,{quantities:new Map(),rows:new Map(),reason:'',reasonKind:''});return drafts.get(day);};
 let dayDraft=draftFor(date);
 const slips=lossSlips(localStorage,RESULT_KEY);
 let currentId=slips.list().find(r=>!r.verified)?.id||slips.list().at(-1)?.id,slipDialog;
 const readResult=()=>slips.get(currentId);
 function clearSlipInputs(r){
  const d=drafts.get(r.draft.date);if(!d)return;
  for(const [id,row] of d.rows)if(r.draft.lines.some(l=>l.sheet===row.name&&l.code===row.code&&l.name===row.drug&&Number(d.quantities.get(id))===l.total)){d.rows.delete(id);d.quantities.delete(id);}
 }
 function openSlips(){
  const records=slips.list().filter(r=>!r.verified);if(disposed||!records.length||slipDialog?.open)return;
  const select=r=>{if(JSON.stringify(slips.get(r.id))!==JSON.stringify(r)){status('單據已變更，請重新開啟清單');return false;}currentId=r.id;showPending();return true;};
  slipDialog=showLossSlips({records,esc,review:r=>{if(select(r))sendLoss(r);},check:r=>{if(select(r))checkPending();},remove:picked=>navigator.locks.request('tcm-loss-slip-update',()=>{
   if(picked.some(r=>r.phase!=='draft'||JSON.stringify(slips.get(r.id))!==JSON.stringify(r))){status('單據已變更，請重新核對');return;}
   for(const r of picked){slips.remove(r.id);clearSlipInputs(r);if(reuseResultId===r.id)reuseResultId='';}
   if(!readResult())currentId=slips.list().find(r=>!r.verified)?.id;
   showPending();draw();status('已移除 '+picked.length+' 筆未送出草稿。');
  })});
 }
 $('#content').innerHTML=`<section class="panel"><div class="panelhead"><div><h2>登錄當日累計耗損</h2><span class="muted">填今天累計耗損幾瓶（限整數）· 只登錄已填品項，留白保留已入帳累計 · 填 0 表示歸零</span></div><a class="secondary" href="${LOSS_SHEET}" target="_blank" rel="noopener">開啟耗損表 ↗</a></div><label>廠商</label><div class="order-tabs" id="loss-brands" role="group" aria-label="耗損廠商"></div><label>類別</label><div class="order-tabs" id="loss-categories" role="group" aria-label="耗損單方或複方"></div><div class="grid"><label>耗損日期<input id="loss-date" type="date" value="${date}" max="${date}"></label><label>經手人<select id="loss-actor" data-staff required disabled><option value="">正在讀取員工名冊…</option></select></label></div><div class="panelhead loss-tools"><input id="loss-search" aria-label="搜尋耗損品項" placeholder="搜尋藥品名稱或編號"><button class="secondary" id="loss-refresh">重新讀取工作表</button></div><p id="loss-state" role="status"></p><p id="loss-qty-help" class="muted">留白：不改已入帳累計。填 0：當日累計歸零。調低已入帳累計時，請在預覽視窗選擇更正原因。</p><div class="tablewrap"><table id="loss-table"><thead><tr><th><button class="sort-heading" data-sort="code">藥品／編號 ↕</button></th><th>廠牌／類別</th><th><button class="sort-heading" data-sort="bottles">原表未拆封瓶數 ↕</button></th><th><button type="button" class="sort-heading" data-sort="posted" aria-label="依當日已入帳耗損排序">當日<br>已入帳耗損 ↕</button></th><th>本次填寫的當日累計</th><th>本次差額</th><th>登錄後瓶數</th><th>原表</th></tr></thead><tbody></tbody></table></div><div class="panelhead loss-pagination" role="group" aria-label="耗損清單分頁"><label>每頁 <select id="loss-page-size" aria-label="每頁顯示筆數"><option value="10">10 筆</option><option value="20">20 筆</option><option value="30">30 筆</option></select></label><span id="loss-page-info" role="status" aria-live="polite"></span><div><button type="button" class="secondary" id="loss-prev">上一頁</button> <button type="button" class="secondary" id="loss-next">下一頁</button></div></div><div class="actions"><span id="loss-summary"></span><button id="loss-clear" type="button" class="secondary">清除本次輸入</button><button type="button" id="loss-submit-complete" class="secondary">預覽並完成正常品項登錄</button></div>${lossCompletionMarkup}<p id="loss-storage-warning" role="status" hidden></p><div id="loss-pending"></div><p class="muted">以 Google 雲端紀錄為準，送出後仍須在 Google 預覽並確認。相同累計不重扣；確認前若有人更新庫存，系統會要求重新預覽。</p><p class="muted">新增品項請先至「藥品建帳」完成 Google 同步，再重新讀取。耗損存入獨立每日明細，不新增或覆寫原表日期欄。</p></section>`;
 $('#content').insertAdjacentHTML('afterbegin',lossLayout);
 const stopWordAxis=alignOrderWord($('#loss-table'));
 const completion=mountLossCompletion($('#content'),{esc,context:()=>({date,sheet:selected?.name})});
 const readLoss=createLossLoader(date=>readLossWithTimeout(async()=>{
  try{return await runDirect('readDailyLossGrid',{date});}
  catch(e){if(!e.message.includes('不支援的操作'))throw e;return runDirect('readLossCatalog',{date});}
 }));
 const status=t=>{$('#loss-state').textContent=t;};
 function summary(){const count=dayDraft.quantities.size;$('#loss-clear').disabled=!count&&!dayDraft.reason.trim()&&!dayDraft.reasonKind;$('#loss-summary').textContent=`已填 ${count} 項（含其他分頁）`;
 document.querySelectorAll('[data-delta]').forEach(cell=>{const r=rowById.get(cell.dataset.delta),result=lossCalculation(dayDraft.quantities.get(r.id),r),after=$('[data-after="'+r.id+'"]');cell.textContent=result.delta;after.textContent=result.after;after.classList.toggle('loss-insufficient',result.insufficient);});}

 function draw(){if(disposed)return;const selection=supplierSelection(sources,brand,category);({brand,category,source:selected}=selection);
 $('#loss-brands').innerHTML=selection.brands.map(b=>`<button type="button" class="secondary ${b===brand?'selected':''}" data-brand="${esc(b)}" aria-pressed="${b===brand}">${esc(b)}</button>`).join('');
 $('#loss-categories').innerHTML=selection.categories.map(k=>`<button type="button" class="secondary ${k===category?'selected':''}" data-category="${esc(k)}" aria-pressed="${k===category}">${esc(k)}</button>`).join('');const q=$('#loss-search').value.trim().toLowerCase(),list=sortSheetRows((cache.get(selected?.gid)||[]).filter(r=>`${r.drug} ${r.code}`.toLowerCase().includes(q)),sort,direction);
 const paged=lossPage(list,page,pageSize);page=paged.page;
 $('#loss-page-size').value=String(pageSize);
 $('#loss-page-info').textContent=paged.total?'第 '+page+'／'+paged.pages+' 頁 · 第 '+paged.start+'–'+paged.end+' 筆，共 '+paged.total+' 筆':'共 0 筆';
 $('#loss-prev').disabled=page<=1;$('#loss-next').disabled=page>=paged.pages;
 $('#loss-table tbody').innerHTML=paged.rows.map(r=>`<tr data-category="${esc(r.category)}"><td data-label="藥品／編號"><span class="aligned-drug"><span class="aligned-drug-icon" aria-hidden="true"></span><span class="aligned-drug-text"><b>${esc(r.drug)}</b><div class="muted">${esc(r.code)}</div>${r.warning?`<div class="muted">${esc(r.warning)}</div>`:''}</span></span></td><td data-label="廠牌／類別">${esc(r.brand)}<div class="muted">${esc(r.category)}</div></td><td data-label="原表未拆封瓶數">${r.bottles===null?'待核對':fmt(r.bottles)+' 瓶'}</td><td data-label="當日已入帳耗損">${r.posted===null?esc(r.postedError||'待核對'):fmt(r.posted)+' 瓶'}</td><td data-label="當日累計耗損"><input aria-describedby="loss-qty-help" class="loss-qty" data-id="${r.id}" aria-label="${esc(r.code)} ${esc(r.drug)} 當日累計" type="number" min="0" step="1" max="1000000" inputmode="numeric" value="${esc(dayDraft.quantities.get(r.id)??'')}" placeholder="不修改"></td><td data-label="本次差額" data-delta="${r.id}"></td><td data-label="登錄後瓶數" data-after="${r.id}"></td><td data-label="原表"><a href="${sheetUrl(r)}" target="_blank" rel="noopener">查看 ↗</a></td></tr>`).join('')||'<tr><td colspan="8">沒有符合的品項</td></tr>';
 document.querySelectorAll('[data-sort]').forEach(b=>{b.parentElement.setAttribute('aria-sort',b.dataset.sort===sort?(direction==='asc'?'ascending':'descending'):'none');b.lastChild.nodeValue=b.lastChild.nodeValue.replace(/[↕↑↓]$/,b.dataset.sort===sort?(direction==='asc'?'↑':'↓'):'↕');});document.querySelectorAll('.loss-qty').forEach(i=>i.oninput=()=>{
  const id=i.dataset.id;
  if(i.value===''){dayDraft.quantities.delete(id);dayDraft.rows.delete(id);}
  else{dayDraft.quantities.set(id,i.value);dayDraft.rows.set(id,rowById.get(id));}
  summary();
 });summary();quantitySteppers($('#loss-table'),'.loss-qty',{base:input=>rowById.get(input.dataset.id)?.posted??0});$('#loss-table').querySelectorAll('.loss-qty').forEach(input=>input.parentElement.querySelector('.quantity-clear').insertAdjacentHTML('beforebegin','<span class="quantity-unit">瓶</span>'));}
 const refreshStatus=createRefreshStatus($('#loss-refresh'));
 let catalogScreen;
 const closeCatalogScreen=()=>{catalogScreen?.close();catalogScreen=undefined;};
 function showCatalog(){
  const list=cache.get(selected?.gid)||[];
  status(`${selected?.name||'尚無分類'} · ${list.length} 項 · ${date} 已核對 · ${list.filter(r=>r.posted===null).length} 項待處理 · 已填累計保留。確認入帳前不扣庫存。`);
  if(completionBySheet)completion.show(completionBySheet[selected?.name]);
  else completion.refresh();
 }
 async function load({showDialog=true}={}){
  if(disposed)return;
  const ticket=++generation,requestedDate=date;
  loading=true;loadFailed=false;refreshStatus.start();completion.show();
  $('#loss-submit-complete').disabled=true;
  const catalogMessage='正在讀取'+requestedDate+' 的品項與當日累計…';status(catalogMessage);
  try{
   if(showDialog&&!isProcessing())catalogScreen=beginProcessing({reading:true,catalogMessage,compact:true});
   const data=verifiedLossCatalog(await readLoss(requestedDate),requestedDate),items=data.rows;
   if(disposed||ticket!==generation)return;
   const nextById=new Map(items.map(row=>[row.id,row]));
   for(const [id,old] of dayDraft.rows){
    const next=nextById.get(id);
    if(!next||next.code!==old.code||next.drug!==old.drug||next.name!==old.name)throw Error('品項位置變更，請先清除未送出數量再重新讀取');
   }
   sources=data.sources;rowById=nextById;completionBySheet=data.completion;cache.clear();
   for(const source of sources)cache.set(source.gid,items.filter(r=>r.name===source.name));
   draw();showCatalog();
  }catch(e){
   if(!disposed&&ticket===generation){loadFailed=true;status(e.message+'；未送出數量仍保留，請重新讀取工作表重試');}
  }finally{
   if(!disposed&&ticket===generation){
    closeCatalogScreen();loading=false;refreshStatus.finish(!loadFailed);
    $('#loss-submit-complete').disabled=loadFailed||!rowById.size;
   }
  }
 }
 const choose=()=>{page=1;$('#loss-search').value='';draw();if(!loading&&!loadFailed)showCatalog();};
 function selectDate(next){
  if(next===date)return;
  date=next;page=1;reuseResultId='';dayDraft=draftFor(date);cache.clear();rowById.clear();completionBySheet=null;draw();
 }
 $('#loss-brands').onclick=e=>{const b=e.target.closest('[data-brand]');if(b){brand=b.dataset.brand;choose();}};$('#loss-categories').onclick=e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;choose();}};$('#loss-search').oninput=()=>{page=1;draw();};$('#loss-refresh').onclick=()=>{if(!loading)load({showDialog:true});};
 $('#loss-clear').onclick=()=>{dayDraft.quantities.clear();dayDraft.rows.clear();dayDraft.reason='';dayDraft.reasonKind='';draw();};
 $('#loss-date').onchange=()=>{
  const field=$('#loss-date'),next=field.value;
  if(!next||!field.validity.valid){field.value=date;message('請選擇有效的耗損日期',true);return;}
  if(next!==date){selectDate(next);load();}
 };
 document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort&&direction==='asc'?'desc':'asc';sort=b.dataset.sort;page=1;draw();});
 $('#loss-page-size').onchange=e=>{pageSize=Number(e.target.value);page=1;draw();};
 const turnPage=step=>{page+=step;draw();$('#loss-table').scrollIntoView({block:'start',behavior:'auto'});};
 $('#loss-prev').onclick=()=>turnPage(-1);$('#loss-next').onclick=()=>turnPage(1);
 function submitLoss(complete){if(loading||loadFailed)return;try{const lines=[];for(const [id,v] of dayDraft.quantities){if(v==='')continue;const row=rowById.get(id);if(reuseResultId&&row&&!lossSheets(slips.get(reuseResultId)?.draft||{lines:[]}).includes(row.name))continue;if(row?.postedError)throw Error(row.drug+'：'+row.postedError);if(!row||row.warning?.includes('編號'))throw Error('請核對藥品編號');lines.push({row,total:Number(v)});}const corrections=lines.filter(({row,total})=>row.posted!=null && total<row.posted);
 const proceed=(reason='')=>{try{const draft=lossDraft(lines,{date,actor:$('#loss-actor').value,reason,completionSheets:complete?[...new Set([selected.name,...lines.map(l=>l.row.name)])]:undefined});
 const prior=slips.list().find(r=>!r.verified&&r.id!==reuseResultId&&r.draft.date===draft.date&&lossSheets(r.draft).some(sheet=>lossSheets(draft).includes(sheet)));
 if(prior)throw Error('此日期與分類已有待處理耗損單，請開啟待處理清單。');
 const old=reuseResultId&&slips.get(reuseResultId);
 if(reuseResultId&&(!old||old.verified||old.phase!=='draft'))throw Error('原草稿已變更，請重新核對');
 const record={id:reuseResultId||'LOSS-'+crypto.randomUUID(),draft,verified:false,phase:'draft'};currentId=record.id;slips.save(record);clearSlipInputs(record);reuseResultId='';draw();showPending();sendLoss(record);
 }catch(e){message(e.message,true);}};
 if(!corrections.length){proceed();return;}
 const items=corrections.map(({row,total})=>'<li>'+esc(row.name)+' · '+esc(row.drug)+'（'+esc(row.code)+'）　'+esc(row.posted)+' → '+esc(total)+' 瓶</li>').join('');
 const options=lossReasons.map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('');
 ask('<h3>每日耗損更正預覽</h3><p>'+esc(date)+' · 以下品項將調低當日累計</p><ul>'+items+'</ul><label>更正原因（必選）<select id="loss-reason-kind" required><option value="">請選擇更正原因</option>'+options+'</select></label><label>補充說明（選填）<textarea id="loss-reason" maxlength="490" rows="2"></textarea></label>',()=>{
 const label=lossReasons.find(([id])=>id===$('#loss-reason-kind').value)?.[1];
 if(!label){message('請選擇更正原因',true);return;}
 const note=$('#loss-reason').value.trim();
 proceed(note?label+'：'+note:label);
 },'繼續核對差額');
 }catch(e){message(e.message,true);}}
 $('#loss-submit-complete').onclick=()=>submitLoss(true);
 function restoreSlipInputs(record){
  const catalog=[...rowById.values()];
  const entries=record.draft.lines.map(line=>{
   const matches=catalog.filter(row=>row.name===line.sheet&&row.code===line.code&&row.drug===line.name);
   if(matches.length!==1)throw Error('品項已變更，請重新核對');
   return {row:matches[0],total:line.total};
  });
  for(const {row,total} of entries){
   dayDraft.quantities.set(row.id,String(total));
   dayDraft.rows.set(row.id,row);
  }
  $('#loss-actor').value=record.draft.actor;
  dayDraft.reason=lossCorrectionReason(record.draft.reason);
  dayDraft.reasonKind=lossReasons.find(([, ,text])=>text&&text===dayDraft.reason)?.[0]||(dayDraft.reason?'other':'');
 }
 async function returnLossPreview(record){
  if(disposed)return;
  try{
   const sameDraft=()=>record.phase==='draft'&&!record.verified&&JSON.stringify(slips.get(record.id))===JSON.stringify(record);
   if(!sameDraft())throw Error('耗損單狀態已變更，請先查詢同步結果。');
   if(date!==record.draft.date){
    selectDate(record.draft.date);$('#loss-date').value=date;await load();
    if(disposed||loadFailed||date!==record.draft.date)return;
   }
   await navigator.locks.request('tcm-loss-slip-update',()=>{
    if(disposed)return;
    if(!sameDraft())throw Error('耗損單狀態已變更，請先查詢同步結果。');
    restoreSlipInputs(record);
    slips.remove(record.id);
    reuseResultId='';
    currentId=slips.list().find(r=>!r.verified)?.id||slips.list().at(-1)?.id;
    draw();showPending();status('已返回表單，可繼續修改各廠牌的耗損數量。');
   });
  }catch(e){if(!disposed){showPending();status(e.message);}}
 }
 const checkPending=createLossResultCheck({readRecord:readResult,writeRecord:record=>slips.save(record),readCloud:async draft=>{const data=await runDirect('readLossCatalog',{date:draft.date});if(draft.completionSheets)data.completion=await Promise.all(draft.completionSheets.map(sheet=>runDirect('readLossDay',{date:draft.date,sheet})));return data;},begin:()=>beginProcessing({reading:true}),blocked:isProcessing,disposed:()=>disposed,report:showLossCheckResult,changed:()=>{reuseResultId='';showPending();}});
 function showPending(){if(disposed)return;pending=readResult();$('#loss-pending').innerHTML=operationResult(pending,'loss',localStorage.getItem(HIDDEN_RESULT));
 const count=slips.list().filter(r=>!r.verified).length;
 const warning=$('#loss-storage-warning');
 warning.hidden=!slips.unreadable.size;
 warning.textContent=warning.hidden?'':'以下本機耗損單無法讀取，已保留原始資料：'+[...slips.unreadable].join('、');
 if(count){const b=document.createElement('button');b.textContent='查看待處理耗損單（'+count+' 筆）';b.onclick=openSlips;$('#loss-pending').prepend(b);}
 if(pending&&!pending.verified&&pending.phase!=='draft')for(const id of ['#loss-cancel','#loss-edit'])if($(id))$(id).disabled=true;
 if($('#loss-hide'))$('#loss-hide').onclick=()=>{localStorage.setItem(HIDDEN_RESULT,pending.id);showPending();};
 if($('#loss-edit'))$('#loss-edit').onclick=()=>{
  if(isProcessing()||loading)return;
  const record=readResult(),original=JSON.stringify(record);
  if(!record||record.verified)return;
  ask("<h3>修改尚未確認累計</h3><p>載入後，表單會帶回上次未確認入帳的日期、品項、經手人和耗損數量，並保留其他品項的輸入。</p><p>請填當天總共耗損幾瓶。系統會用「修改後的當日累計 − 目前已入帳耗損」重算本次差額。例如已入帳 3 瓶，改填 5 瓶，確認入帳後會扣 2 瓶。</p><p>修改後請先預覽差額，按「確認入帳」才會更新庫存。</p>",async()=>{
   if(disposed||isProcessing()||loading)return;
   if(JSON.stringify(readResult())!==original){status('待登錄內容已變更，請重新核對');return;}
   selectDate(record.draft.date);$('#loss-date').value=date;await load();if(disposed||loadFailed||date!==record.draft.date)return;
   if(JSON.stringify(readResult())!==original){status('待登錄內容已變更，請重新核對');return;}
   try{restoreSlipInputs(record);reuseResultId=record.id;draw();status('已載入原日期與累計量；修改後重新預覽，確認前不扣庫存。');}catch(e){status(e.message);}
  },'載入並修改');
 };
 if($('#loss-cancel'))$('#loss-cancel').onclick=async()=>{
  if(isProcessing()||loading)return;const record=readResult(),original=JSON.stringify(record);if(!record||record.verified)return;
  let screen;try{screen=beginProcessing({reading:true});const data=await runDirect('readLossCatalog',{date:record.draft.date});const lines=lossCancellationSummary(record.draft,data);if(disposed||JSON.stringify(readResult())!==original)return;
   screen.close();screen=null;
   ask('<h3>取消本次待登錄數量</h3><p>僅清除這筆本機待登錄內容，不會將雲端耗損歸零，也不會加回庫存。</p><ul>'+lines.map(l=>'<li>'+esc(l.sheet)+' '+esc(l.code)+' '+esc(l.name)+'：預計累計 '+esc(l.total)+' 瓶；雲端目前已登錄 '+esc(l.posted)+' 瓶</li>').join('')+'</ul><p>若曾在其他分頁開啟這筆確認畫面，請一併關閉，勿再送出。</p>',()=>{
    if(disposed||isProcessing())return;if(JSON.stringify(readResult())!==original){status('待登錄內容已變更，請重新核對後取消');return;}
    localStorage.setItem('tcm-loss-last-cancelled-v1',JSON.stringify({...record,cancelledAt:new Date().toISOString(),cloudTotals:lines}));slips.remove(record.id);localStorage.removeItem(HIDDEN_RESULT);
    if(date===record.draft.date)for(const line of record.draft.lines)for(const row of rowById.values())if(row.name===line.sheet&&row.code===line.code&&row.drug===line.name&&Number(dayDraft.quantities.get(row.id))===line.total){dayDraft.quantities.delete(row.id);dayDraft.rows.delete(row.id);}
    reuseResultId='';showPending();draw();status('已取消本次本機待登錄數量；雲端已入帳耗損及庫存保持不變。');
   },'取消本次待登錄數量');
  }catch(e){if(!disposed)status('尚未取消：'+e.message);}finally{screen?.close();}
 };
 if($('#loss-resume'))$('#loss-resume').onclick=()=>sendLoss(pending);
 if($('#loss-check'))$('#loss-check').onclick=checkPending;
 }
 function markSent(record){
  const live=slips.get(record.id);
  if(!live||live.verified||live.phase!==record.phase||JSON.stringify(live.draft)!==JSON.stringify(record.draft))throw Error('耗損單已變更或移除，請重新核對');
  slips.save({...live,phase:'submitted'});
 }
 function sendLoss(record){const draft={...record.draft,reason:lossCorrectionReason(record.draft.reason)};
 const onReturn=record.phase==='draft'&&!record.verified?()=>returnLossPreview(record):undefined;
 const beforeCommit=()=>navigator.locks.request('tcm-loss-slip-update',()=>markSent(record));
 if(directEnabled())return directReview(draft,ask,async()=>{slips.save({...record,verified:true,phase:'posted'});if(disposed)return;reuseResultId='';clearSlipInputs(record);if(date===record.draft.date){dayDraft=draftFor(date);cache.clear();rowById.clear();}showPending();await load();},text=>{if(!disposed)message(text);},{beforeCommit,onReturn,reviewIntro:()=>draft.reason?'<p>更正原因：'+esc(draft.reason)+'</p>':''});
 ask('<p>將重新開啟這筆耗損的 Google 核對頁，日期與累計量保持不變，確認前不扣庫存。</p>',async()=>{try{await beforeCommit();}catch(e){status(e.message);return;}const form=document.createElement('form');form.method='POST';form.action=LOSS_ENDPOINT;form.target='_blank';const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=JSON.stringify(draft);form.append(input);document.body.append(form);form.submit();form.remove();message('已開啟 Google 核對頁，請於完成後查詢同步結果。');},'開啟 Google 核對頁',undefined,onReturn);
 }
 showPending();
 if(directEnabled()){const notes=$('#loss-submit-complete').parentElement.parentElement.querySelectorAll(':scope > p.muted');notes[0].textContent='在站內核對差額後按確認入帳。相同累計不重扣；雲端資料變更時需重新預覽。';notes[1].textContent='新增品項請先至藥品建帳；耗損存入獨立每日明細。若要將整個分類標記完成，請選「預覽並完成正常品項登錄」。';}const stopCatalogWatch=watchSupplierCatalog(load);const sync=()=>load();window.addEventListener('erp-synced',sync);load({showDialog:true}).finally(openSlips);return protectDraft(()=>{disposed=true;slipDialog?.close();closeCatalogScreen();stopWordAxis();completion.dispose();stopCatalogWatch();generation++;window.removeEventListener('erp-synced',sync);},()=>[...drafts.values()].some(d=>d.quantities.size>0||d.reason.trim()!==''||!!d.reasonKind));
}
