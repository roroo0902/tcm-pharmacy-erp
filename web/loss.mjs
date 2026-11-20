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
import {runDirect,directEnabled,directReview} from './direct-sync.mjs?v=compact20261030';
import {sheetUrl} from './sheets-data.mjs?v=compact20261030';
import {sortSheetRows} from './sheets-sort.mjs?v=postedloss20261114';
import {today} from './store.mjs';
import {LOSS_ENDPOINT,LOSS_SHEET,lossPostedRows,lossDraft,lossCorrectionReason} from './loss-cloud.mjs?v=lossrevision20261120';
const RESULT_KEY='tcm-loss-result-v1',HIDDEN_RESULT='tcm-loss-hidden-result-v1';
export function mountLoss({esc,fmt,ask,message}){
 const $=s=>document.querySelector(s),cache=new Map(),drafts=new Map();let rowById=new Map(),completionBySheet=null,sources=[],selected=null,brand='',category='',loading=false,loadFailed=false,sort='code',direction='asc',disposed=false,generation=0,date=today(),pending=null,reuseResultId='';
 const draftFor=day=>{if(!drafts.has(day))drafts.set(day,{quantities:new Map(),rows:new Map(),reason:''});return drafts.get(day);};
 let dayDraft=draftFor(date);
 const readResult=()=>{try{return JSON.parse(localStorage.getItem(RESULT_KEY)||'null');}catch{return null;}};
 $('#content').innerHTML=`<section class="panel"><div class="panelhead"><div><h2>登錄當日累計耗損</h2><span class="muted">填今天累計耗損幾瓶（限整數）· 只登錄已填品項，留白保留已入帳累計 · 填 0 表示歸零</span></div><a class="secondary" href="${LOSS_SHEET}" target="_blank" rel="noopener">開啟耗損表 ↗</a></div><label>廠商</label><div class="order-tabs" id="loss-brands" role="group" aria-label="耗損廠商"></div><label>類別</label><div class="order-tabs" id="loss-categories" role="group" aria-label="耗損單方或複方"></div><div class="grid"><label>耗損日期<input id="loss-date" type="date" value="${date}" max="${date}"></label><label>經手人<select id="loss-actor" data-staff required disabled><option value="">正在讀取員工名冊…</option></select></label><label class="full">更正原因（調低累計或歸零必填）<textarea id="loss-reason" maxlength="500" rows="2"></textarea></label></div><div class="panelhead loss-tools"><input id="loss-search" aria-label="搜尋耗損品項" placeholder="搜尋藥品名稱或編號"><button class="secondary" id="loss-refresh">重新讀取工作表</button></div><p id="loss-state" role="status"></p><p id="loss-qty-help" class="muted">留白：不改已入帳累計。填 0：當日累計歸零。調低或歸零前，請填上方「更正原因」。</p><div class="tablewrap"><table id="loss-table"><thead><tr><th><button class="sort-heading" data-sort="code">藥品／編號 ↕</button></th><th>廠牌／類別</th><th><button class="sort-heading" data-sort="bottles">原表未拆封瓶數 ↕</button></th><th><button type="button" class="sort-heading" data-sort="posted" aria-label="依當日已入帳耗損排序">當日<br>已入帳耗損 ↕</button></th><th>本次填寫的當日累計</th><th>本次差額</th><th>登錄後瓶數</th><th>原表</th></tr></thead><tbody></tbody></table></div><div class="actions"><span id="loss-summary"></span><button id="loss-clear" type="button" class="secondary">清除本次輸入</button><button id="loss-submit">預覽本次已填品項</button><button type="button" id="loss-submit-complete" class="secondary">預覽並完成正常品項登錄</button></div>${lossCompletionMarkup}<div id="loss-pending"></div><p class="muted">以 Google 雲端紀錄為準，送出後仍須在 Google 預覽並確認。相同累計不重扣；確認前若有人更新庫存，系統會要求重新預覽。</p><p class="muted">新增品項請先至「藥品建帳」完成 Google 同步，再重新讀取。耗損存入獨立每日明細，不新增或覆寫原表日期欄。</p></section>`;
 $('#loss-reason').oninput=e=>{dayDraft.reason=e.target.value;};
 $('#content').insertAdjacentHTML('afterbegin',lossLayout);
 const stopWordAxis=alignOrderWord($('#loss-table'));
 const completion=mountLossCompletion($('#content'),{esc,context:()=>({date,sheet:selected?.name})});
 const readLoss=createLossLoader(date=>readLossWithTimeout(async()=>{
  try{return await runDirect('readDailyLossGrid',{date});}
  catch(e){if(!e.message.includes('不支援的操作'))throw e;return runDirect('readLossCatalog',{date});}
 }));
 const status=t=>{$('#loss-state').textContent=t;};
 function summary(){const count=dayDraft.quantities.size;$('#loss-clear').disabled=!count;$('#loss-summary').textContent=`已填 ${count} 項（含其他分頁）`;
 document.querySelectorAll('[data-delta]').forEach(cell=>{const r=rowById.get(cell.dataset.delta),result=lossCalculation(dayDraft.quantities.get(r.id),r),after=$('[data-after="'+r.id+'"]');cell.textContent=result.delta;after.textContent=result.after;after.classList.toggle('loss-insufficient',result.insufficient);});}

 function draw(){if(disposed)return;$('#loss-reason').value=dayDraft.reason;const selection=supplierSelection(sources,brand,category);({brand,category,source:selected}=selection);
 $('#loss-brands').innerHTML=selection.brands.map(b=>`<button type="button" class="secondary ${b===brand?'selected':''}" data-brand="${esc(b)}" aria-pressed="${b===brand}">${esc(b)}</button>`).join('');
 $('#loss-categories').innerHTML=selection.categories.map(k=>`<button type="button" class="secondary ${k===category?'selected':''}" data-category="${esc(k)}" aria-pressed="${k===category}">${esc(k)}</button>`).join('');const q=$('#loss-search').value.trim().toLowerCase(),list=sortSheetRows((cache.get(selected?.gid)||[]).filter(r=>`${r.drug} ${r.code}`.toLowerCase().includes(q)),sort,direction);
 $('#loss-table tbody').innerHTML=list.map(r=>`<tr data-category="${esc(r.category)}"><td data-label="藥品／編號"><span class="aligned-drug"><span class="aligned-drug-icon" aria-hidden="true"></span><span class="aligned-drug-text"><b>${esc(r.drug)}</b><div class="muted">${esc(r.code)}</div>${r.warning?`<div class="muted">${esc(r.warning)}</div>`:''}</span></span></td><td data-label="廠牌／類別">${esc(r.brand)}<div class="muted">${esc(r.category)}</div></td><td data-label="原表未拆封瓶數">${r.bottles===null?'待核對':fmt(r.bottles)+' 瓶'}</td><td data-label="當日已入帳耗損">${r.posted===null?esc(r.postedError||'待核對'):fmt(r.posted)+' 瓶'}</td><td data-label="當日累計耗損"><input aria-describedby="loss-qty-help" class="loss-qty" data-id="${r.id}" aria-label="${esc(r.code)} ${esc(r.drug)} 當日累計" type="number" min="0" step="1" max="1000000" inputmode="numeric" value="${esc(dayDraft.quantities.get(r.id)??'')}" placeholder="不修改"></td><td data-label="本次差額" data-delta="${r.id}"></td><td data-label="登錄後瓶數" data-after="${r.id}"></td><td data-label="原表"><a href="${sheetUrl(r)}" target="_blank" rel="noopener">查看 ↗</a></td></tr>`).join('')||'<tr><td colspan="8">沒有符合的品項</td></tr>';
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
  $('#loss-submit').disabled=true;$('#loss-submit-complete').disabled=true;
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
    $('#loss-submit').disabled=loadFailed||!rowById.size;$('#loss-submit-complete').disabled=$('#loss-submit').disabled;
   }
  }
 }
 const choose=()=>{$('#loss-search').value='';draw();if(!loading&&!loadFailed)showCatalog();};
 function selectDate(next){
  if(next===date)return;
  date=next;reuseResultId='';dayDraft=draftFor(date);cache.clear();rowById.clear();completionBySheet=null;draw();
 }
 $('#loss-brands').onclick=e=>{const b=e.target.closest('[data-brand]');if(b){brand=b.dataset.brand;choose();}};$('#loss-categories').onclick=e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;choose();}};$('#loss-search').oninput=draw;$('#loss-refresh').onclick=()=>{if(!loading)load({showDialog:true});};
 $('#loss-clear').onclick=()=>{dayDraft.quantities.clear();dayDraft.rows.clear();dayDraft.reason='';draw();};
 $('#loss-date').onchange=()=>{
  const field=$('#loss-date'),next=field.value;
  if(!next||!field.validity.valid){field.value=date;message('請選擇有效的耗損日期',true);return;}
  if(next!==date){selectDate(next);load();}
 };
 document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort&&direction==='asc'?'desc':'asc';sort=b.dataset.sort;draw();});
 function submitLoss(complete){if(loading||loadFailed)return;try{const lines=[];for(const [id,v] of dayDraft.quantities){if(v==='')continue;const row=rowById.get(id);if(row?.postedError)throw Error(row.drug+'：'+row.postedError);if(!row||row.warning?.includes('編號'))throw Error('請核對藥品編號');lines.push({row,total:Number(v)});}const draft=lossDraft(lines,{date,actor:$('#loss-actor').value,reason:dayDraft.reason,completionSheets:complete?[...new Set([selected.name,...lines.map(l=>l.row.name)])]:undefined});
 const prior=readResult();if(prior&&!prior.verified&&reuseResultId!==prior.id)throw Error('上一筆耗損尚未確認，請先查詢同步結果或重新確認這筆操作。');
 const record={id:reuseResultId||'LOSS-'+crypto.randomUUID(),draft,verified:false};localStorage.setItem(RESULT_KEY,JSON.stringify(record));showPending();sendLoss(record);
 }catch(e){message(e.message,true);if(e.message.includes('更正原因'))$('#loss-reason').focus();}}
 $('#loss-submit').onclick=()=>submitLoss(false);
 $('#loss-submit-complete').onclick=()=>submitLoss(true);
 const checkPending=createLossResultCheck({readRecord:readResult,writeRecord:record=>localStorage.setItem(RESULT_KEY,JSON.stringify(record)),readCloud:async draft=>{const data=await runDirect('readLossCatalog',{date:draft.date});if(draft.completionSheets)data.completion=await Promise.all(draft.completionSheets.map(sheet=>runDirect('readLossDay',{date:draft.date,sheet})));return data;},begin:()=>beginProcessing({reading:true}),blocked:isProcessing,disposed:()=>disposed,report:showLossCheckResult,changed:()=>{reuseResultId='';showPending();}});
 function showPending(){if(disposed)return;pending=readResult();$('#loss-pending').innerHTML=operationResult(pending,'loss',localStorage.getItem(HIDDEN_RESULT));
 if($('#loss-hide'))$('#loss-hide').onclick=()=>{localStorage.setItem(HIDDEN_RESULT,pending.id);showPending();};
 if($('#loss-edit'))$('#loss-edit').onclick=()=>{
  if(isProcessing()||loading)return;
  const record=readResult(),original=JSON.stringify(record);
  if(!record||record.verified)return;
  ask("<h3>修改尚未確認累計</h3><p>載入後，表單會帶回上次未確認入帳的日期、品項、經手人和耗損數量，並取代目前填寫的數量。</p><p>請填當天總共耗損幾瓶。系統會用「修改後的當日累計 − 目前已入帳耗損」重算本次差額。例如已入帳 3 瓶，改填 5 瓶，確認入帳後會扣 2 瓶。</p><p>修改後請先預覽差額，按「確認入帳」才會更新庫存。</p>",async()=>{
   if(disposed||isProcessing()||loading)return;
   if(JSON.stringify(readResult())!==original){status('待登錄內容已變更，請重新核對');return;}
   selectDate(record.draft.date);$('#loss-date').value=date;await load();if(disposed||loadFailed||date!==record.draft.date)return;
   if(JSON.stringify(readResult())!==original){status('待登錄內容已變更，請重新核對');return;}
   try{const selectedRows=record.draft.lines.map(line=>{const matches=[...rowById.values()].filter(r=>r.name===line.sheet&&r.code===line.code&&r.drug===line.name);if(matches.length!==1)throw Error('品項已變更，請重新核對');return {row:matches[0],line};});dayDraft.quantities.clear();dayDraft.rows.clear();for(const {row,line} of selectedRows){dayDraft.quantities.set(row.id,String(line.total));dayDraft.rows.set(row.id,row);}$('#loss-actor').value=record.draft.actor;dayDraft.reason=lossCorrectionReason(record.draft.reason);reuseResultId=record.id;draw();status('已載入原日期與累計量；修改後重新預覽，確認前不扣庫存。');}catch(e){status(e.message);}
  },'載入並修改');
 };
 if($('#loss-cancel'))$('#loss-cancel').onclick=async()=>{
  if(isProcessing()||loading)return;const record=readResult(),original=JSON.stringify(record);if(!record||record.verified)return;
  let screen;try{screen=beginProcessing({reading:true});const data=await runDirect('readLossCatalog',{date:record.draft.date});const lines=lossCancellationSummary(record.draft,data);if(disposed||JSON.stringify(readResult())!==original)return;
   screen.close();screen=null;
   ask('<h3>取消本次待登錄數量</h3><p>僅清除這筆本機待登錄內容，不會將雲端耗損歸零，也不會加回庫存。</p><ul>'+lines.map(l=>'<li>'+esc(l.sheet)+' '+esc(l.code)+' '+esc(l.name)+'：預計累計 '+esc(l.total)+' 瓶；雲端目前已登錄 '+esc(l.posted)+' 瓶</li>').join('')+'</ul><p>若曾在其他分頁開啟這筆確認畫面，請一併關閉，勿再送出。</p>',()=>{
    if(disposed||isProcessing())return;if(JSON.stringify(readResult())!==original){status('待登錄內容已變更，請重新核對後取消');return;}
    localStorage.setItem('tcm-loss-last-cancelled-v1',JSON.stringify({...record,cancelledAt:new Date().toISOString(),cloudTotals:lines}));localStorage.removeItem(RESULT_KEY);localStorage.removeItem(HIDDEN_RESULT);
    if(date===record.draft.date)for(const line of record.draft.lines)for(const row of rowById.values())if(row.name===line.sheet&&row.code===line.code&&row.drug===line.name&&Number(dayDraft.quantities.get(row.id))===line.total){dayDraft.quantities.delete(row.id);dayDraft.rows.delete(row.id);}
    reuseResultId='';showPending();draw();status('已取消本次本機待登錄數量；雲端已入帳耗損及庫存保持不變。');
   },'取消本次待登錄數量');
  }catch(e){if(!disposed)status('尚未取消：'+e.message);}finally{screen?.close();}
 };
 if($('#loss-resume'))$('#loss-resume').onclick=()=>sendLoss(pending);
 if($('#loss-check'))$('#loss-check').onclick=checkPending;
 }
 function sendLoss(record){const draft={...record.draft,reason:lossCorrectionReason(record.draft.reason)};
 if(directEnabled())return directReview(draft,ask,async()=>{if(readResult()?.id===record.id)localStorage.setItem(RESULT_KEY,JSON.stringify({...record,verified:true}));if(disposed)return;reuseResultId='';drafts.delete(record.draft.date);if(date===record.draft.date){dayDraft=draftFor(date);cache.clear();rowById.clear();}showPending();await load();},text=>{if(!disposed)message(text);},{reviewIntro:()=>draft.reason?'<p>更正原因：'+esc(draft.reason)+'</p>':''});
 ask('<p>將重新開啟這筆耗損的 Google 核對頁，日期與累計量保持不變，確認前不扣庫存。</p>',()=>{const form=document.createElement('form');form.method='POST';form.action=LOSS_ENDPOINT;form.target='_blank';const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=JSON.stringify(draft);form.append(input);document.body.append(form);form.submit();form.remove();message('已開啟 Google 核對頁，請於完成後查詢同步結果。');},'開啟 Google 核對頁');
 }
 showPending();
 if(directEnabled()){$('#loss-submit').textContent='預覽本次已填品項';const notes=$('#loss-submit').parentElement.parentElement.querySelectorAll(':scope > p.muted');notes[0].textContent='在站內核對差額後按確認入帳。相同累計不重扣；雲端資料變更時需重新預覽。';notes[1].textContent='新增品項請先至藥品建帳；耗損存入獨立每日明細。若要將整個分類標記完成，請選「預覽並完成正常品項登錄」。';}const stopCatalogWatch=watchSupplierCatalog(load);const sync=()=>load();window.addEventListener('erp-synced',sync);load({showDialog:true});return()=>{disposed=true;closeCatalogScreen();stopWordAxis();completion.dispose();stopCatalogWatch();generation++;window.removeEventListener('erp-synced',sync);};
}
