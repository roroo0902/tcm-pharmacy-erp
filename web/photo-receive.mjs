import {protectDraft} from './page-safety.mjs';
import {photoModelLabel} from './photo-model.mjs';
import {loadReceiptCatalog} from './supplier-catalog.mjs';
import {directEnabled,authorize,runDirect,directReview,directLog} from './direct-sync.mjs?v=release20261120r1';
import {cloudDraft} from '../src/cloud-transaction.mjs';
import {csvRows} from './sheets-data.mjs';
import {lookupPostedTransaction} from './pending-recovery.mjs';
import {matchRecognized,cleanRecognized,addToBasket,receiptCandidates} from '../src/photo-receive-data.mjs?v=receiptweight20261120';
import {quantitySteppers} from './quantity-stepper.mjs';
const KEY='tcm-cloud-pending-v1',DISCARDED='tcm-photo-receipt-last-discarded-v1';
const todayTaipei=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
const unitMessage=unit=>(unit==='瓶'||unit==='罐')?'照片單位可能正確，仍需核對':'照片不是「瓶／罐」，請手動換算成實際入庫瓶數';

async function jpegData(file){
 if(!file||!file.type.startsWith('image/'))throw Error('請上傳藥品或進貨單照片');
 if(file.size>12_000_000)throw Error('照片超過 12MB，請先縮小');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('無法讀取照片，建議改用 JPG 或 PNG'));img.src=url;});
  const ratio=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);
  if(!canvas.width||!canvas.height)throw Error('照片尺寸無效');
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/jpeg',0.72).split(',')[1];
  if(data.length>3_200_000)throw Error('壓縮後照片仍過大，請裁切為單張單據再上傳');
  return data;
 }finally{URL.revokeObjectURL(url);}
}

function renderPhotoReview(lines,{esc,candidatesFor,matchLine,unitMessage}){
 const list=lines.filter(line=>!line.removed);
 if(!list.length)return '<p class="muted">辨識後，這裡會顯示每一筆藥名、數量及配對結果。</p>';
 const rows=list.map(line=>{
  const match=matchLine(line);
  if(!line.manualSelection){
   const selection=match.row?String(match.row.id):'';
   if(selection!==line.selected)line.reviewed=false;
   line.selected=selection;
  }
  const candidates=candidatesFor(line);
  const found=candidates.find(row=>String(row.id)===line.selected);
  const options=candidates.map(row=>'<option value="'+esc(String(row.id))+'">'+esc(row.category+'｜'+row.code+'｜'+row.drug)+'</option>').join('');
  const name=esc(line.name||'未讀出藥名'),id=esc(line.id);
  line.sourceQuantity??=line.quantity;
  return '<tr><td><strong>'+name+'</strong><small>原始編號 '+esc(line.code||'未讀出')+'</small></td>'+
   '<td>'+esc(line.unit||'單位不明')+'／'+esc(line.sourceQuantity||'數量不明')+
   '<details><summary>原始辨識</summary>'+esc(line.evidence||'無可核對文字')+'<small>'+esc(unitMessage(line.unit))+'</small></details></td>'+
   '<td><div class="ai-review-match"><span class="ai-review-state"'+(found?' data-matched':'')+'>'+esc(found?.category||'待配對')+'</span>'+
   '<select data-select="'+id+'" aria-label="'+name+' 配對庫存藥品"><option value="">請選擇相符藥品</option>'+options+'</select></div>'+
   '<small>'+esc(found?'現庫存 '+(found.bottles??'待核對')+' 瓶'+(line.manualSelection?'':' · '+match.reason):match.reason)+'</small></td>'+
   '<td><input data-qty="'+id+'" aria-label="'+name+' 實際入庫瓶數" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="'+esc(line.quantity)+'"></td>'+
   '<td><input data-reviewed="'+id+'" type="checkbox" aria-label="'+name+' 已逐項核對藥名、編號、單位與瓶數" '+(line.reviewed?'checked':'')+'></td>'+
   '<td><button type="button" data-remove="'+id+'" aria-label="排除 '+name+'" class="secondary small">排除</button></td></tr>';
 }).join('');
 return '<div class="ai-review-head"><h3>核對辨識結果</h3><span data-ai-review-count role="status"></span></div>'+
  '<p class="muted ai-review-note">請核對藥名、規格及數量。單據以盒、袋或包計量時，請填寫換算後的實際入庫瓶數。</p>'+
  '<div class="ai-review-wrap" tabindex="0" role="region" aria-label="核對辨識結果表格"><table class="ai-review-table"><thead><tr>'+
  '<th scope="col">藥品／原始編號</th><th scope="col">規格／單據數量</th><th scope="col">配對庫存藥品</th><th scope="col">入庫瓶數</th><th scope="col">已核對</th><th scope="col">操作</th>'+
  '</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function updatePhotoReviewCount(root,lines){
 const count=root.querySelector('[data-ai-review-count]');
 if(count)count.textContent='已辨識 '+lines.length+' 項 · 已核對 '+lines.filter(line=>line.reviewed&&!line.removed).length+' 項'+(lines.some(line=>line.removed)?' · 已排除 '+lines.filter(line=>line.removed).length+' 項':'');
}

export function mountPhotoReceive({esc,fmt,ask}){
 const root=document.querySelector('#content');
 let alive=true,run=0,rows=[],recognized=[],basket=[],pastedImage=null,loading=false,selected='',pending=null,catalogReady=false;
 root.innerHTML="<style>#photo-receive-panel{text-align:center}#photo-receive-panel label,#photo-receive-panel input,#photo-receive-panel select{text-align:center}#photo-receive-panel select{text-align-last:center}#photo-receive-panel .panelhead,#photo-receive-panel .actions,#photo-receive-panel .staff-controls{justify-content:center}#photo-receive-panel th,#photo-receive-panel td,body:has(#photo-receive-panel) .direct-review-table th,body:has(#photo-receive-panel) .direct-review-table td{text-align:center;vertical-align:middle}\nbody:has(#photo-receive-panel) aside{background:#102641}\nbody:has(#photo-receive-panel) aside nav a.active{border-color:#cda653;border-radius:0;box-shadow:inset 0 0 0 2px #182b45, inset 0 0 0 3px #b78e43;background:#203957}\n#photo-receive-panel .ai-review-head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px 18px;margin:18px 0 6px;text-align:left}\n#photo-receive-panel .ai-review-head h3{margin:0}\n#photo-receive-panel .ai-review-note{text-align:left;margin:0 0 10px}\n#photo-receive-panel .ai-review-wrap{overflow:auto;max-height:36rem;border:2px solid #755030;background:#f7e6c1;box-shadow:inset 0 0 0 2px #c4985b}\n#photo-receive-panel table.ai-review-table{width:100%;min-width:850px;border-collapse:separate;border-spacing:0;color:#3d2a1b}\n#photo-receive-panel .ai-review-table :is(th,td){padding:6px 9px;border-right:1px solid #c4a27366;border-bottom:1px solid #c4a27366;line-height:1.25}\n#photo-receive-panel .ai-review-table th{position:sticky;top:0;z-index:2;background:#e7c993;color:#392313;text-align:left;white-space:nowrap}\n#photo-receive-panel .ai-review-table td{background:linear-gradient(110deg,#fff8e6,#f5e2bc);text-align:left}\n#photo-receive-panel .ai-review-table tr:nth-child(even) td{background:linear-gradient(110deg,#fcf0d3,#f0d9ac)}\n#photo-receive-panel .ai-review-table :is(th,td):nth-child(n+4){text-align:center}\n#photo-receive-panel .ai-review-table small{display:block;font-size:12px;color:#614a35;margin-top:3px}\n#photo-receive-panel .ai-review-table details{font-size:12px;max-width:220px;margin-top:3px}\n#photo-receive-panel .ai-review-table summary{cursor:pointer}\n#photo-receive-panel .ai-review-table select{max-width:100%;width:100%;min-height:32px;margin:0;font-size:14px;text-align:left;text-align-last:left}\n#photo-receive-panel .ai-review-match{display:grid;grid-template-columns:auto minmax(120px,1fr);align-items:center;gap:6px}\n#photo-receive-panel .ai-review-state{padding:3px 6px;white-space:nowrap;background:#efd194;color:#65400f;border:1px solid #b98536;font-size:12px}\n#photo-receive-panel .ai-review-state[data-matched]{background:#dce8c0;border-color:#859a57;color:#314421}\n#photo-receive-panel .ai-review-table .quantity-stepper{width:138px;grid-template-columns:30px minmax(50px,1fr) 30px;gap:4px;margin:auto}\n#photo-receive-panel .ai-review-table .quantity-stepper input{min-height:32px;font-size:14px}\n#photo-receive-panel .ai-review-table .quantity-stepper .quantity-clear{display:none}\n#photo-receive-panel .ai-review-table input[type=checkbox]{width:18px;height:18px;margin:0;accent-color:#285331}\n#photo-receive-panel :is(#ai-scan,#ai-reload,#ai-add,#ai-preview,[data-remove],.ai-review-table .quantity-adjust){background:linear-gradient(#f7db93,#d6a74b);color:#35220e;border:2px solid #805722;border-radius:3px;box-shadow:inset 0 0 0 1px #ffedb1,0 2px 0 #60401b}\n#photo-receive-panel .ai-review-table :is([data-remove],.quantity-adjust){min-height:32px;font-size:14px}\n#photo-receive-panel .ai-review-table .quantity-adjust{min-width:30px}\n#photo-receive-panel .ai-review-table [data-remove]{white-space:nowrap;padding:4px 8px}\n #photo-receive-panel .ai-entry-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#photo-receive-panel .ai-entry-grid>label{min-width:0}#photo-receive-panel [hidden]{display:none!important}#photo-receive-panel .ai-wizard{width:112px;height:140px;object-fit:contain;image-rendering:pixelated;flex-shrink:0}#photo-receive-panel .ai-wizard-heading{gap:18px}@media(max-width:480px){#photo-receive-panel .ai-wizard{width:80px;height:100px}#photo-receive-panel .ai-wizard-heading{gap:8px}#photo-receive-panel .ai-wizard-heading h2{font-size:20px}} #photo-receive-panel .ai-wizard-heading{display:grid;grid-template-columns:112px minmax(0,1fr) 112px;align-items:center;gap:18px}#photo-receive-panel .ai-wizard-heading>div{text-align:center}#photo-receive-panel .ai-suppliers{text-align:left;grid-column:1/-1}#photo-receive-panel .ai-entry-grid>.full{grid-column:1/-1}@media(max-width:600px){#photo-receive-panel .ai-wizard-heading{grid-template-columns:1fr;justify-items:center;gap:8px}} </style>"+'<section class="panel" id="photo-receive-panel"><div class="panelhead ai-wizard-heading"><img class="ai-wizard" src="./web/assets/photo-wizard.png" alt="手持發光法杖的藥庫魔法師" width="112" height="140"><div><h2>AI 拍照進貨</h2><span class="muted">選廠商 → 拍照 → AI 解析 → 人工核對 → 預覽 → 確認入庫</span></div></div>'+
  '<p class="notice">AI 辨識結果只是草稿。必須選到現有藥品並逐項核對，最後會再次讀取 Google 即時庫存；未確認不會修改庫存。</p>'+
  '<div class="grid ai-entry-grid"><div class="full ai-suppliers"><span id="ai-source-label">廠商</span><div id="ai-source" class="order-tabs" role="group" aria-labelledby="ai-source-label"></div></div><label>進貨日期<input type="date" id="ai-date" max="'+todayTaipei()+'" value="'+todayTaipei()+'"></label><label>經手人<select id="ai-actor" data-staff data-staff-compact required disabled><option value="">正在讀取員工名冊…</option></select></label><label class="full">單據或備註（選填）<select id="ai-note"><option value="">不填寫備註</option><option>依送貨單進貨</option><option>補填入送到貨單</option><option>無附進貨單直接入庫</option><option>換貨補回</option><option>其他</option></select></label><label class="full" id="ai-note-other-field" hidden>其他說明（選填）<input type="text" id="ai-note-other" maxlength="490" placeholder="請填寫補充內容"></label><label class="full">拍照或選擇照片<input id="ai-image" type="file" accept="image/*" capture="environment"><small id="ai-image-hint" role="status">也可選取此欄位後貼上圖片。</small></label></div>'+
  '<div class="actions"><button type="button" id="ai-scan">AI 解析照片</button><button type="button" class="secondary" id="ai-reload">更新現有藥品</button></div><p id="ai-status" role="status"></p>'+
  '<div id="ai-result"></div><div class="actions"><button type="button" id="ai-add" disabled>核對後加入進貨清單</button></div><h3>本次進貨清單（尚未入庫）</h3><div id="ai-basket"></div><div class="actions"><button type="button" id="ai-preview" disabled>預覽庫存變化並確認同步</button></div><section id="ai-pending"></section></section>';
 const $=sel=>root.querySelector(sel);
 $('#ai-note').onchange=()=>{$('#ai-note-other-field').hidden=$('#ai-note').value!=='其他';};
 const noteValue=()=>$('#ai-note').value==='其他'?['其他',$('#ai-note-other').value.trim()].filter(Boolean).join('：'):$('#ai-note').value.trim();
 const status=text=>{if(alive)$('#ai-status').textContent=text;};
 const lockBusy=busy=>{loading=busy;if(!alive)return;$('#ai-scan').disabled=busy;$('#ai-reload').disabled=busy;$('#ai-add').disabled=busy||!catalogReady||!recognized.some(x=>!x.removed);};
 function currentRows(){return rows.filter(r=>r.brand===selected);}
 async function load(){
  if(!alive)return;
  const seq=++run;catalogReady=false;rows=[];
  recognized.forEach(line=>{line.reviewed=false;});drawResult();
  status('正在讀取已啟用廠商與藥品名冊…');
  try{
   const catalog=await loadReceiptCatalog();
   if(seq!==run||!alive)return;
   const brands=[...new Set(catalog.sources.map(source=>source.brand))];
   const previous=selected;
   selected=brands.includes(selected)?selected:brands[0];
   if(previous&&previous!==selected)recognized=[];
   $('#ai-source').innerHTML=brands.map(brand=>'<button type="button" class="secondary '+(brand===selected?'selected':'')+'" data-ai-brand="'+esc(brand)+'" aria-pressed="'+(brand===selected)+'">'+esc(brand)+'</button>').join('');
   rows=catalog.rows;catalogReady=true;drawResult();drawBasket();
   status('已讀取 '+selected+' 共 '+currentRows().length+' 項；100g 品項只比對單方。');
  }catch(error){if(seq===run&&alive){rows=[];catalogReady=false;drawResult();status(error.message);}}
 }

 const matchLine=(line)=>matchRecognized(line,currentRows());
 function drawResult(){
  if(!alive)return;
  const list=recognized.filter(x=>!x.removed);
  const review=$('#ai-result');
  const scroll=review.querySelector('.ai-review-wrap');
  const left=scroll?.scrollLeft??0, top=scroll?.scrollTop??0;
  review.innerHTML=renderPhotoReview(recognized,{esc,candidatesFor:line=>receiptCandidates(line,currentRows()),matchLine,unitMessage});
  review.querySelector('.ai-review-wrap')?.scrollTo(left,top);
  updatePhotoReviewCount(root,recognized);
  root.querySelectorAll('[data-select]').forEach(el=>{const line=recognized.find(x=>x.id===el.dataset.select);el.value=line.selected;el.onchange=()=>{line.selected=el.value;line.manualSelection=true;line.reviewed=false;drawResult();root.querySelector('[data-select="'+line.id+'"]')?.focus({preventScroll:true});};});
  root.querySelectorAll('[data-qty]').forEach(el=>el.oninput=()=>{const line=recognized.find(x=>x.id===el.dataset.qty);line.quantity=el.value;line.reviewed=false;root.querySelector('[data-reviewed="'+line.id+'"]').checked=false;updatePhotoReviewCount(root,recognized);});
  root.querySelectorAll('[data-reviewed]').forEach(el=>el.onchange=()=>{recognized.find(x=>x.id===el.dataset.reviewed).reviewed=el.checked;updatePhotoReviewCount(root,recognized);});
  root.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{recognized.find(x=>x.id===el.dataset.remove).removed=true;drawResult();});
  quantitySteppers(root,'[data-qty]');
  $('#ai-add').disabled=!list.length||!catalogReady||loading;
 }
 function drawBasket(){
  if(!alive)return;
  $('#ai-basket').innerHTML=basket.length?'<div class="tablewrap"><table><thead><tr><th>藥品</th><th>原庫存</th><th>本次進貨</th><th>預估庫存</th><th>修改</th></tr></thead><tbody>'+
  basket.map((line,i)=>{const r=rows.find(x=>x.name===line.sheet&&x.code===line.code&&x.drug===line.name);return '<tr><td>'+esc(line.sheet+' '+line.code+' '+line.name)+'</td><td>'+esc(r?.bottles??'待更新')+'</td><td>'+fmt(line.quantity)+'</td><td>'+esc(r?fmt(r.bottles+line.quantity):'待更新')+'</td><td><button type="button" class="secondary small" data-basket-remove="'+i+'">移除</button></td></tr>';}).join('')+'</tbody></table></div>':'<p class="muted">尚未加入品項。可依序上傳多張照片，將品項累積到同一進貨清單。</p>';
  root.querySelectorAll('[data-basket-remove]').forEach(b=>b.onclick=()=>{basket.splice(Number(b.dataset.basketRemove),1);drawBasket();});
  $('#ai-preview').disabled=!basket.length;
 }
 $('#ai-source').onclick=event=>{const button=event.target.closest('[data-ai-brand]');if(!button||loading||button.dataset.aiBrand===selected)return;selected=button.dataset.aiBrand;recognized=[];drawResult();load();};
 $('#ai-reload').onclick=async()=>{try{if(directEnabled())await authorize();await load();}catch(error){status(error.message);}};

 $('#ai-image').onchange=()=>{pastedImage=null;$('#ai-image-hint').textContent='也可選取此欄位後貼上圖片。';};
 $('#ai-image').onpaste=event=>{
  const image=[...(event.clipboardData?.files||[])].find(file=>file.type.startsWith('image/'));
  if(!image)return;
  event.preventDefault();
  $('#ai-image').value='';pastedImage=image;
  $('#ai-image-hint').textContent='已貼上圖片，可開始辨識。';
 };
 $('#ai-scan').onclick=async()=>{
  if(loading)return;
  try{
   if(!directEnabled())throw Error('AI 拍照功能需要已授權的 Google 雲端入口');
   if(!catalogReady||!currentRows().length)throw Error('請先完成此廠商的藥品清單讀取');
   const file=$('#ai-image').files[0]||pastedImage;if(!file)throw Error('請先上傳照片');
   const scanBrand=selected,scanRun=run;
   lockBusy(true);status('正在壓縮照片、辨識藥名與數量…');
   await authorize();
   if(!alive||selected!==scanBrand||scanRun!==run)return;
   const base64=await jpegData(file);
   if(!alive||selected!==scanBrand||scanRun!==run)return;
   const result=await runDirect('recognizeReceipt',{brand:scanBrand,mimeType:'image/jpeg',base64});
   if(!alive||selected!==scanBrand||scanRun!==run){status('已切換廠商，上一張照片的辨識結果未套用。');return;}
   // Do not persist the image or raw API response in localStorage.
   recognized=cleanRecognized(result);
   if(!recognized.length)throw Error('AI 未辨識到藥品項目，請重拍或改用一般進貨登錄');
   drawResult();status('AI 辨識 '+recognized.length+' 項；'+photoModelLabel(result)+'；請逐項比對，並由人工勾選核對。');
  }catch(error){status(error.message);}finally{lockBusy(false);}
 };
 $('#ai-add').onclick=()=>{
  try{
   if(!catalogReady||loading)throw Error('請等待完整名冊及辨識載入完成');
   const active=recognized.filter(x=>!x.removed);const next=addToBasket(basket,active,currentRows(),selected);
   basket=next;recognized=[];pastedImage=null;$('#ai-image').value='';$('#ai-image-hint').textContent='也可選取此欄位後貼上圖片。';drawResult();drawBasket();status('已加入清單；尚未同步。可切換廠商再拍下一張照片。');
  }catch(error){status(error.message);}
 };
 function showPending(){
  if(!alive)return;
  try{pending=JSON.parse(localStorage.getItem(KEY)||'null');}catch{pending=null;}
  const unresolved=pending&&pending.kind==='tcm-cloud'&&!pending.verified;
  $('#ai-pending').innerHTML=unresolved?'<h3>上次有一筆待核對交易</h3><p>交易編號：'+esc(pending.id)+'</p><p class="muted">為防止重複入庫，在讀回或以同一交易重試前，不能建立另一筆新進貨。</p><button type="button" id="ai-retry" class="secondary">使用原交易重新核對</button><button type="button" id="ai-readback" class="secondary">查詢 Google 交易紀錄</button>'+(pending.action==='進貨'?'<button type="button" id="ai-discard" class="secondary">取消未入帳的待核對紀錄</button>':''):'';
  if(unresolved){
   $('#ai-retry').onclick=()=>send(cloudDraft(pending));
   const discard=$('#ai-discard');
   if(discard)discard.onclick=()=>{
    const saved=localStorage.getItem(KEY),original=pending;
    if(!saved||JSON.parse(saved).id!==original.id){showPending();status('待核對紀錄已變動，請重新查詢。');return;}
    ask('<p>系統會再次查詢 Google 交易紀錄。查無入帳時，將保留本機備份並取消這筆待核對紀錄。</p><p>交易編號：'+esc(original.id)+'</p>',async()=>{
     try{
      const draft=cloudDraft(JSON.parse(saved));
      if(draft.action!=='進貨'||JSON.parse(saved).verified)throw Error('只可取消未入帳的待核對進貨。');
      const event=await lookupPostedTransaction(draft);
      if(!alive)return;
      if(localStorage.getItem(KEY)!==saved)throw Error('待核對紀錄已變動，請重新查詢。');
      if(event)throw Error('Google 已有這筆入帳紀錄，請先核對入帳結果。');
      localStorage.setItem(DISCARDED,JSON.stringify({draft:JSON.parse(saved),cancelledAt:new Date().toISOString()}));
      localStorage.removeItem(KEY);
      showPending();status('Google 查無入帳，已取消這筆待核對紀錄並保留本機備份。');
     }catch(error){status(error.message);}
    },'查詢並取消待核對紀錄');
   };
   $('#ai-readback').onclick=async()=>{try{await authorize();const response=await directLog('inventory');const record=csvRows(await response.text()).slice(1).find(r=>r[0]===pending.id);if(!record)throw Error('未發現該交易；請沿用原交易編號重新核對');const stored=JSON.parse(record[1]).draft;if(JSON.stringify(cloudDraft(stored))!==JSON.stringify(cloudDraft(pending)))throw Error('同編號內容與雲端不一致，請停止操作');localStorage.setItem(KEY,JSON.stringify({...pending,verified:true}));showPending();status('已查到相同交易的入庫紀錄');}catch(error){status(error.message);}};
  }
 }
 function send(draft){
  if(!directEnabled()){status('目前僅支援經授權的 Google 同步，尚未送出');return;}
  directReview(draft,ask,async()=>{
   localStorage.setItem(KEY,JSON.stringify({...draft,verified:true}));basket=[];drawBasket();showPending();await load();
  },status,{beforeCommit:()=>{if(JSON.parse(localStorage.getItem(KEY)||'null')?.id!==draft.id)throw Error('待核對紀錄已變動，請重新預覽。');}});
 }
 $('#ai-preview').onclick=()=>{
  try{
   if(!basket.length)throw Error('請先加入進貨清單');
   const prior=JSON.parse(localStorage.getItem(KEY)||'null');
   if(prior&&!prior.verified)throw Error('上一筆交易結果未明，請先核對原交易');
   const draft=cloudDraft({kind:'tcm-cloud',version:1,id:'ERP-'+crypto.randomUUID(),action:'進貨',date:$('#ai-date').value,actor:$('#ai-actor').value.trim(),note:noteValue(),lines:basket.map(({sheet,code,name,quantity})=>({sheet,code,name,quantity}))});
   // Persist the ID and exact draft before preview to keep retries idempotent.
   localStorage.setItem(KEY,JSON.stringify(draft));showPending();send(draft);
  }catch(error){status(error.message);}
 };
 window.addEventListener('erp-synced',load);
 drawResult();drawBasket();showPending();load();
 return protectDraft(()=>{alive=false;run++;window.removeEventListener('erp-synced',load);},()=>loading||basket.length>0||recognized.some(line=>!line.removed)||Boolean(pastedImage)||Boolean($('#ai-image')?.files?.length)||Boolean($('#ai-note')?.value?.trim())||Boolean($('#ai-note-other')?.value?.trim()));
}