import {priceCents} from './receipt-pricing.mjs';
import {itemRegistration} from './item-registration.mjs';
import {protectDraft} from './page-safety.mjs';
import {photoModelLabel} from './photo-model.mjs';
import {loadReceiptCatalog} from './supplier-catalog.mjs';
import {directEnabled,authorize,runDirect,directReview} from './direct-sync.mjs?v=release20261120r1';
import {cloudDraft} from '../src/cloud-transaction.mjs';
import {lookupPostedTransaction} from './pending-recovery.mjs';
import {normalizeDrug,matchRecognized,cleanRecognized,addToBasket,receiptCandidates,photoBasket} from '../src/photo-receive-data.mjs?v=photoReturn20261127';
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

function renderPhotoReview(lines,{esc,categories,candidatesFor,matchLine,unitMessage}){
 const list=lines.filter(line=>!line.removed);
 if(!list.length)return '<p class="muted">辨識後，這裡會顯示每一筆藥名、數量及配對結果。</p>';
 const rows=list.map(line=>{
  const match=matchLine(line);
  if(!line.manualSelection){
   const selection=match.row?String(match.row.id):'';
   if(selection!==line.selected)line.reviewed=false;
   line.selected=selection;
  }
  const available=candidatesFor(line);
  const selectedRow=available.find(row=>String(row.id)===line.selected);
  const category=line.categoryFilter??selectedRow?.category??'';
  const candidates=category?available.filter(row=>row.category===category):available;
  const categoryOptions=categories.map(value=>'<option value="'+esc(value)+'" '+(value===category?'selected':'')+'>'+esc(value)+'</option>').join('');
  const found=candidates.find(row=>String(row.id)===line.selected);
  const options=candidates.map(row=>'<option value="'+esc(String(row.id))+'">'+esc(row.category+'｜'+row.code+'｜'+row.drug+(row.vendorCode?'｜廠商 '+row.vendorCode:''))+'</option>').join('');
  const name=esc(line.name||'未讀出藥名'),id=esc(line.id);
  line.sourceQuantity??=line.quantity;
  return '<tr><td><strong>'+name+'</strong><small>原始編號 '+esc(line.code||'未讀出')+'</small></td>'+
   '<td>'+esc(line.unit||'單位不明')+'／'+esc(line.sourceQuantity||'數量不明')+
   '<details><summary>原始辨識</summary>'+esc(line.evidence||'無可核對文字')+'<small>'+esc(unitMessage(line.unit))+'</small></details></td>'+
   '<td><div class="ai-review-match"><select class="ai-review-state"'+(found?' data-matched':'')+' style="width:auto;flex:0 0 auto" data-receipt-category="'+id+'" aria-label="'+name+' 庫存類別"><option value="">全部</option>'+categoryOptions+'</select>'+
   '<div data-picker><div class="receipt-current-match">'+esc(found?found.code+'｜'+found.drug:'待配對')+'</div>'+(found?.vendorCell?'<a href="'+esc(found.vendorCell)+'" target="_blank" rel="noopener">'+esc(found.vendorCode?'廠商品號：'+found.vendorCode+'（修改）':'補登廠商品號')+'</a>':'')+'<input type="search" data-drug-search="'+id+'" aria-label="'+name+' 搜尋編號或藥名" placeholder="輸入編號或藥名" autocomplete="off">'+
   '<select data-select="'+id+'" aria-label="'+name+' 配對庫存藥品"><option value="">請選擇相符藥品</option>'+options+'</select>'+
   '<button type="button" data-new-drug hidden>＋新增庫存藥品</button><div data-registration hidden></div></div></div>'+
   '<small>'+esc(found?'現庫存 '+(found.bottles??'待核對')+' 瓶'+(line.manualSelection?'':' · '+match.reason):line.manualSelection?(candidates.length?'請選擇相符藥品':'此類別沒有符合的藥品'):match.reason)+'</small></td>'+
   '<td><input data-qty="'+id+'" aria-label="'+name+' 實際入庫瓶數" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="'+esc(line.quantity)+'"></td>'+
   '<td><input data-photo-price="'+id+'" aria-label="'+name+' 單價" type="number" min="0" max="1000000" step="0.01" inputmode="decimal" placeholder="未提供" value="'+esc(line.price??(found?.unitPriceCents==null?'':found.unitPriceCents/100))+'"></td>'+
   '<td><input data-reviewed="'+id+'" type="checkbox" aria-label="'+name+' 已核對配對品項" '+(line.reviewed?'checked':'')+'></td>'+
   '<td><button type="button" data-remove="'+id+'" aria-label="排除 '+name+'" class="secondary small">排除</button></td></tr>';
 }).join('');
 return '<div class="ai-review-head"><h3>核對辨識結果</h3><span data-ai-review-count role="status"></span></div>'+
  '<p class="muted ai-review-note">請核對藥名、規格及數量。單據以盒、袋或包計量時，請填寫換算後的實際入庫瓶數。</p>'+
  '<div class="ai-review-wrap" tabindex="0" role="region" aria-label="核對辨識結果表格"><table class="ai-review-table"><thead><tr>'+
  '<th scope="col">藥品／原始編號</th><th scope="col">規格／單據數量</th><th scope="col">配對庫存藥品</th><th scope="col">入庫瓶數</th><th scope="col">單價（元／瓶）</th><th scope="col">已核對</th><th scope="col">操作</th>'+
  '</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function updatePhotoReviewCount(root,lines){
 const count=root.querySelector('[data-ai-review-count]');
 if(count)count.textContent='已辨識 '+lines.length+' 項 · 已核對 '+lines.filter(line=>line.reviewed&&!line.removed).length+' 項'+(lines.some(line=>line.removed)?' · 已排除 '+lines.filter(line=>line.removed).length+' 項':'');
}

export function mountPhotoReceive({esc,fmt,ask}){
 const root=document.querySelector('#content');
 let alive=true,run=0,rows=[],sources=[],recognized=[],basket=[],pastedImage=null,loading=false,selected='',pending=null,catalogReady=false;
 root.innerHTML="<style>#photo-receive-panel{text-align:center}#photo-receive-panel label,#photo-receive-panel input,#photo-receive-panel select{text-align:center}#photo-receive-panel select{text-align-last:center}#photo-receive-panel .panelhead,#photo-receive-panel .actions,#photo-receive-panel .staff-controls{justify-content:center}#photo-receive-panel th,#photo-receive-panel td,body:has(#photo-receive-panel) .direct-review-table th,body:has(#photo-receive-panel) .direct-review-table td{text-align:center;vertical-align:middle}\nbody:has(#photo-receive-panel) aside{background:#102641}\nbody:has(#photo-receive-panel) aside nav a.active{border-color:#cda653;border-radius:0;box-shadow:inset 0 0 0 2px #182b45, inset 0 0 0 3px #b78e43;background:#203957}\n#photo-receive-panel .ai-review-head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px 18px;margin:18px 0 6px;text-align:left}\n#photo-receive-panel .ai-review-head h3{margin:0}\n#photo-receive-panel .ai-review-note{text-align:left;margin:0 0 10px}\n#photo-receive-panel .ai-review-wrap{overflow:auto;max-height:36rem;border:2px solid #755030;background:#f7e6c1;box-shadow:inset 0 0 0 2px #c4985b}\n#photo-receive-panel table.ai-review-table{width:100%;min-width:850px;border-collapse:separate;border-spacing:0;color:#3d2a1b}\n#photo-receive-panel .ai-review-table :is(th,td){padding:6px 9px;border-right:1px solid #c4a27366;border-bottom:1px solid #c4a27366;line-height:1.25}\n#photo-receive-panel .ai-review-table th{position:sticky;top:0;z-index:2;background:#e7c993;color:#392313;text-align:left;white-space:nowrap}\n#photo-receive-panel .ai-review-table td{background:linear-gradient(110deg,#fff8e6,#f5e2bc);text-align:left}\n#photo-receive-panel .ai-review-table tr:nth-child(even) td{background:linear-gradient(110deg,#fcf0d3,#f0d9ac)}\n#photo-receive-panel .ai-review-table :is(th,td):nth-child(n+4){text-align:center}\n#photo-receive-panel .ai-review-table small{display:block;font-size:12px;color:#614a35;margin-top:3px}\n#photo-receive-panel .ai-review-table details{font-size:12px;max-width:220px;margin-top:3px}\n#photo-receive-panel .ai-review-table summary{cursor:pointer}\n#photo-receive-panel .ai-review-table select{max-width:100%;width:100%;min-height:32px;margin:0;font-size:14px;text-align:left;text-align-last:left}\n#photo-receive-panel .ai-review-match{display:grid;grid-template-columns:auto minmax(120px,1fr);align-items:center;gap:6px}\n#photo-receive-panel .ai-review-match [data-picker]{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;gap:3px}#photo-receive-panel [data-picker]>:is(input,select){display:block;position:static;box-sizing:border-box;width:100%;min-width:0;max-width:100%;grid-column:1}#photo-receive-panel .receipt-current-match{font-weight:700;white-space:normal;overflow-wrap:anywhere}#photo-receive-panel [data-registration]:not([hidden]){display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:8px;padding:10px;border:1px solid #c4a273;box-sizing:border-box;min-width:0}#photo-receive-panel [data-registration] label{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:3px;margin:0;min-width:0;text-align:left}#photo-receive-panel [data-registration] :is(input,select){box-sizing:border-box;width:100%;max-width:100%;min-width:0;margin:0}#photo-receive-panel [data-registration] :is(p,small,.registration-actions){grid-column:1/-1;margin:0}#photo-receive-panel .registration-actions{display:flex;flex-wrap:wrap;gap:6px}#photo-receive-panel [data-registration][hidden]{display:none}#photo-receive-panel .ai-review-state{padding:3px 6px;white-space:nowrap;background:#efd194;color:#65400f;border:1px solid #b98536;font-size:12px}\n#photo-receive-panel .ai-review-state[data-matched]{background:#dce8c0;border-color:#859a57;color:#314421}\n#photo-receive-panel .ai-review-table .quantity-stepper{width:138px;grid-template-columns:30px minmax(50px,1fr) 30px;gap:4px;margin:auto}\n#photo-receive-panel .ai-review-table .quantity-stepper input{min-height:32px;font-size:14px}\n#photo-receive-panel .ai-review-table .quantity-stepper .quantity-clear{display:none}\n#photo-receive-panel .ai-review-table input[type=checkbox]{width:18px;height:18px;margin:0;accent-color:#285331}\n#photo-receive-panel :is(#ai-scan,#ai-reload,#ai-add,#ai-preview,[data-remove],.ai-review-table .quantity-adjust){background:linear-gradient(#f7db93,#d6a74b);color:#35220e;border:2px solid #805722;border-radius:3px;box-shadow:inset 0 0 0 1px #ffedb1,0 2px 0 #60401b}\n#photo-receive-panel .ai-review-table :is([data-remove],.quantity-adjust){min-height:32px;font-size:14px}\n#photo-receive-panel .ai-review-table .quantity-adjust{min-width:30px}\n#photo-receive-panel .ai-review-table [data-remove]{white-space:nowrap;padding:4px 8px}\n #photo-receive-panel .ai-entry-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#photo-receive-panel .ai-entry-grid>label{min-width:0}#photo-receive-panel [hidden]{display:none!important}#photo-receive-panel .ai-wizard{width:112px;height:140px;object-fit:contain;image-rendering:pixelated;flex-shrink:0}#photo-receive-panel .ai-wizard-heading{gap:18px}@media(max-width:480px){#photo-receive-panel .ai-wizard{width:80px;height:100px}#photo-receive-panel .ai-wizard-heading{gap:8px}#photo-receive-panel .ai-wizard-heading h2{font-size:20px}} #photo-receive-panel .ai-wizard-heading{display:grid;grid-template-columns:112px minmax(0,1fr) 112px;align-items:center;gap:18px}#photo-receive-panel .ai-wizard-heading>div{text-align:center}#photo-receive-panel .ai-suppliers{text-align:left;grid-column:1/-1}#photo-receive-panel .ai-entry-grid>.full{grid-column:1/-1}@media(max-width:600px){#photo-receive-panel .ai-wizard-heading{grid-template-columns:1fr;justify-items:center;gap:8px}} </style>"+'<section class="panel" id="photo-receive-panel"><div class="panelhead ai-wizard-heading"><img class="ai-wizard" src="./web/assets/photo-wizard.png" alt="手持發光法杖的藥庫魔法師" width="112" height="140"><div><h2>AI 拍照進貨</h2><span class="muted">選廠商 → 拍照 → AI 解析 → 人工核對 → 預覽 → 確認入庫</span></div></div>'+
  '<p class="notice">AI 辨識結果只是草稿。必須選到現有藥品並逐項核對，最後會再次讀取 Google 即時庫存；未確認不會修改庫存。</p>'+
  '<div class="grid ai-entry-grid"><div class="full ai-suppliers"><span id="ai-source-label">廠商</span><div id="ai-source" class="order-tabs" role="group" aria-labelledby="ai-source-label"></div></div><label>進貨日期<input type="date" id="ai-date" max="'+todayTaipei()+'" value="'+todayTaipei()+'"></label><label>經手人<select id="ai-actor" data-staff data-staff-compact required disabled><option value="">正在讀取員工名冊…</option></select></label><label class="full">單據或備註（選填）<select id="ai-note"><option value="">不填寫備註</option><option>依送貨單進貨</option><option>補填入送到貨單</option><option>無附進貨單直接入庫</option><option>換貨補回</option><option>其他</option></select></label><div class="full" id="ai-note-other-field" hidden><label for="ai-note-other">其他說明（選填）</label><input type="text" id="ai-note-other" maxlength="490" placeholder="請填寫補充內容"><div class="actions"><button type="button" class="secondary" id="ai-note-back">返回上一個選項</button></div></div><label class="full">拍照或選擇照片<input id="ai-image" type="file" accept="image/*" capture="environment"><small id="ai-image-hint" role="status">也可選取此欄位後貼上圖片。</small></label></div>'+
  '<div class="actions"><button type="button" id="ai-scan">AI 解析照片</button><button type="button" class="secondary" id="ai-reload">更新現有藥品</button></div><p id="ai-status" role="status"></p>'+
  '<img id="ai-original" hidden alt="本張進貨原照片" style="max-width:100%;max-height:220px;object-fit:contain"><div id="ai-result" tabindex="-1"></div><div class="actions"><button type="button" id="ai-add" disabled>核對後加入進貨清單</button></div><h3>本次進貨清單（尚未入庫）</h3><div id="ai-basket"></div><div class="actions"><button type="button" id="ai-preview" disabled>預覽庫存變化並確認同步</button></div><section id="ai-pending"></section></section>';
 root.insertAdjacentHTML('beforeend', `
 <style>
 #ai-catalog-dialog{box-sizing:border-box;width:min(710px,94vw);max-height:90dvh;overflow:auto;padding:22px;color:#182f49;background:#fff7e5;border:5px double #9d772f;border-radius:4px;box-shadow:0 0 0 2px #193451,0 12px 40px #16263b55;text-align:center}
 #ai-catalog-dialog::backdrop{background:#13263b66;backdrop-filter:blur(2px)}
 .ai-dialog-content{display:grid;grid-template-columns:clamp(64px,20vw,158px) minmax(0,1fr);align-items:center;gap:clamp(10px,3vw,28px);text-align:left}
 .ai-dialog-content img{width:100%;image-rendering:pixelated}
 #ai-catalog-dialog h3{font-size:clamp(19px,4vw,34px);line-height:1.25;color:#142b50;margin:3px 0 0}.ai-dialog-caption{color:#805312;font-weight:600}
 .ai-dialog-footer{border-top:1px solid #bb913e;padding-top:10px;line-height:1.65;font-size:14px}
 .ai-dialog-dots{display:flex;gap:10px;justify-content:flex-start;margin:14px 0}
 .ai-dialog-dots i{width:8px;height:8px;background:#bb8828;animation:ai-catalog-pulse 1s steps(2,end) infinite}
 .ai-dialog-dots i:nth-child(2){animation-delay:.2s}.ai-dialog-dots i:nth-child(3){animation-delay:.4s}
 @keyframes ai-catalog-pulse{50%{opacity:.3}}@media(prefers-reduced-motion:reduce){.ai-dialog-dots i{animation:none}}
 #ai-catalog-dialog [hidden]{display:none}
 </style>
 <dialog id="ai-catalog-dialog" aria-labelledby="ai-catalog-title"><div class="ai-dialog-content">
 <picture><source media="(prefers-reduced-motion: no-preference)" srcset="./web/assets/photo-wizard-rays.gif"><img src="./web/assets/photo-wizard.png" alt=""></picture><div>
 <div class="ai-dialog-caption">正在讀取已啟用的</div><h3 id="ai-catalog-title">廠商與藥品名冊</h3>
 <div class="ai-dialog-dots" aria-hidden="true"><i></i><i></i><i></i></div>
 <div class="ai-dialog-footer">讀取完成後自動關閉，已填內容會保留。<br>僅讀取資料，不會入帳或變更庫存。</div>
 <div id="ai-catalog-error" hidden><p role="alert"></p><button type="button">重新讀取</button> <button class="secondary" type="button">關閉</button></div>
 </div></div></dialog>`);
 const $=sel=>root.querySelector(sel);
 let batches=[],editing=null,scanPhoto=null,photoUrl='',submission=null;
 function displayPhoto(file){
  if(photoUrl)URL.revokeObjectURL(photoUrl);
  photoUrl=file?URL.createObjectURL(file):'';
  const image=$('#ai-original');
  image.hidden=!file;
  if(file)image.src=photoUrl;else image.removeAttribute?.('src');
 }
 let previousNote=$('#ai-note').value;
 const showOtherNote=()=>{$('#ai-note-other-field').hidden=$('#ai-note').value!=='其他';};
 $('#ai-note').onchange=()=>{if($('#ai-note').value!=='其他')previousNote=$('#ai-note').value;showOtherNote();};
 $('#ai-note-back').onclick=()=>{$('#ai-note').value=previousNote;showOtherNote();$('#ai-note').focus?.();};
 const noteValue=()=>$('#ai-note').value==='其他'?['其他',$('#ai-note-other').value.trim()].filter(Boolean).join('：'):$('#ai-note').value.trim();
 const status=text=>{if(alive)$('#ai-status').textContent=text;};
 const lockBusy=busy=>{loading=busy;if(!alive)return;$('#ai-scan').disabled=busy||!!submission;$('#ai-preview').disabled=busy||!basket.length||(editing!==null||recognized.some(line=>!line.removed));$('#ai-reload').disabled=busy;$('#ai-add').disabled=busy||!catalogReady||!editing&&!recognized.some(x=>!x.removed);};
 function currentRows(){return rows.filter(r=>r.brand===selected);}
 const catalogDialog=$('#ai-catalog-dialog');
 const catalogTitle=$('#ai-catalog-title');
 const catalogError=$('#ai-catalog-error');
 function showCatalogState(message=null){
  $('.ai-dialog-caption').hidden=message!==null;
  catalogTitle.textContent=message===null?'廠商與藥品名冊':'名冊讀取失敗';
  catalogError.hidden=message===null;
  $('.ai-dialog-dots').hidden=message!==null;
  $('.ai-dialog-footer').hidden=message!==null;
  if(message!==null)$('#ai-catalog-error p').textContent=message;
  if(!catalogDialog.open)catalogDialog.showModal();
 }
 $('#ai-catalog-error button').onclick=()=>load({fresh:true});
 $('#ai-catalog-error .secondary').onclick=()=>catalogDialog.close();
 let registrationCatalogFresh=false;
 function onSync(){
  if(registrationCatalogFresh){registrationCatalogFresh=false;return;}
  load();
 }
 function drawBrandButtons(brands){
  $('#ai-source').innerHTML=brands.map(brand=>'<button type="button" class="secondary '+(brand===selected?'selected':'')+'" data-ai-brand="'+esc(brand)+'" aria-pressed="'+(brand===selected)+'">'+esc(brand)+'</button>').join('');
 }
 async function load({fresh=false}={}){
  if(!alive)return;
  const seq=++run;catalogReady=false;rows=[];
  recognized.forEach(line=>{line.reviewed=false;});drawResult();
  showCatalogState();
  try{
   const catalog=await loadReceiptCatalog({fresh});
   if(seq!==run||!alive)return;
   const brands=[...new Set(catalog.sources.map(source=>source.brand))];
   const previous=selected;
   selected=brands.includes(selected)?selected:brands[0];
   if(previous&&previous!==selected)recognized=[];
   drawBrandButtons(brands);
   sources=catalog.sources;rows=catalog.rows;catalogReady=true;drawResult();drawBasket();catalogDialog.close();
   status('已讀取 '+selected+' 共 '+currentRows().length+' 項；100g 品項只比對單方。');
  }catch(error){if(seq===run&&alive){rows=[];catalogReady=false;drawResult();status(error.message);showCatalogState(error.message);}}
 }

 const matchLine=(line)=>matchRecognized(line,currentRows());
 function drawResult(){
  if(!alive)return;
  const list=recognized.filter(x=>!x.removed);
  const review=$('#ai-result');
  const scroll=review.querySelector('.ai-review-wrap');
  const left=scroll?.scrollLeft??0, top=scroll?.scrollTop??0;
  review.innerHTML=renderPhotoReview(recognized,{esc,categories:[...new Set(sources.filter(source=>source.brand===selected).map(source=>source.category))],candidatesFor:line=>receiptCandidates(line,currentRows()),matchLine,unitMessage});
  review.querySelector('.ai-review-wrap')?.scrollTo(left,top);
  updatePhotoReviewCount(root,recognized);
  root.querySelectorAll('[data-receipt-category]').forEach(el=>el.onchange=()=>{
   const line=recognized.find(item=>item.id===el.dataset.receiptCategory);
   line.categoryFilter=el.value;
   line.manualSelection=true;
   line.reviewed=false;
   if(el.value&&!currentRows().some(row=>String(row.id)===line.selected&&row.category===el.value))line.selected='';
   drawResult();
   review.querySelector('[data-receipt-category="'+line.id+'"]')?.focus({preventScroll:true});
  });
  root.querySelectorAll('[data-select]').forEach(el=>{const line=recognized.find(x=>x.id===el.dataset.select);el.value=line.selected;el.onchange=()=>{line.selected=el.value;line.manualSelection=true;line.reviewed=false;drawResult();root.querySelector('[data-select="'+line.id+'"]')?.focus({preventScroll:true});};});
  root.querySelectorAll('[data-drug-search]').forEach(input=>{
   const picker=input.closest('[data-picker]');
   const select=picker.querySelector('select');
   const original=Array.from(select.options);
   const committed=select.value;
   const add=picker.querySelector('[data-new-drug]');
   const panel=picker.querySelector('[data-registration]');
   const line=recognized.find(item=>item.id===input.dataset.drugSearch);
   add.onclick=()=>{
    const eligible=receiptCandidates(line,sources.filter(source=>source.brand===selected));
    const current=picker.closest('td').querySelector('[data-receipt-category]').value;
    panel.hidden=false;
    panel.innerHTML='<label>廠商 <strong>'+esc(selected)+'</strong></label><label>類別<select data-source><option value="">請選擇類別</option>'+
     eligible.map(source=>'<option value="'+esc(source.name)+'" '+(source.category===current?'selected':'')+'>'+esc(source.category)+'</option>').join('')+
     '</select></label><label>藥品名稱<input data-name maxlength="120" value="'+esc(input.value.trim())+'"></label>'+
     '<label>廠商品號（選填）<input data-code maxlength="60" placeholder="可留白，之後補登"></label>'+
     '<p>期初 0 瓶，本次進貨另行入帳。</p><div class="registration-actions"><button type="button" data-cancel>取消</button> <button type="button" data-save>確認建檔並配對</button></div><small role="status"></small>';
    panel.querySelector('[data-code]').focus();
    panel.querySelector('[data-cancel]').onclick=()=>{panel.hidden=true;close();};
    panel.querySelector('[data-save]').onclick=async()=>{
     const message=panel.querySelector('[role=status]');
     try{
      if(!directEnabled())throw Error('請先連線 Google');
      const prior=JSON.parse(localStorage.getItem(KEY)||'null');
      if(prior&&!prior.verified)throw Error('請先核對上一筆交易');
      const source=eligible.find(item=>item.name===panel.querySelector('[data-source]').value);
      const vendorCode=panel.querySelector('[data-code]').value.trim();
      if(/[｜|\r\n]/.test(vendorCode))throw Error('廠商品號不可包含分隔線或換行');
      if(vendorCode&&rows.some(row=>row.brand===selected&&[row.code,row.vendorCode].some(code=>code&&normalizeDrug(code)===normalizeDrug(vendorCode))))throw Error('此廠商品號已有對應品項');
      const item=itemRegistration(source,'RX-'+crypto.randomUUID(),panel.querySelector('[data-name]').value,0,rows);
      const draft=cloudDraft({kind:'tcm-cloud',version:1,id:'ERP-'+crypto.randomUUID(),action:'建檔',date:$('#ai-date').value,actor:$('#ai-actor').value.trim(),note:vendorCode?'廠商品號｜'+item.code+'｜'+vendorCode:'拍照進貨新增品項',lines:[item]});
      await directReview(draft,ask,async()=>{
       const catalog=await loadReceiptCatalog({fresh:true});
       const matches=catalog.rows.filter(row=>row.name===item.sheet&&row.code===item.code&&row.drug===item.name);
       if(matches.length!==1||(vendorCode&&matches[0].vendorCode!==vendorCode))throw Error('建檔已送出，尚未從名冊讀回唯一品項，請核對建檔紀錄');
       if(JSON.parse(localStorage.getItem(KEY)||'null')?.id===draft.id)localStorage.setItem(KEY,JSON.stringify({...draft,verified:true}));
       if(!alive||!recognized.includes(line))return;
       sources=catalog.sources;rows=catalog.rows;
       Object.assign(line,{selected:String(matches[0].id),manualSelection:true,categoryFilter:source.category,reviewed:true});
       drawResult();showPending();registrationCatalogFresh=true;
      },text=>{message.textContent=text;status(text);},{beforeCommit:()=>{
       const latest=JSON.parse(localStorage.getItem(KEY)||'null');
       if(latest&&!latest.verified&&latest.id!==draft.id)throw Error('請先核對上一筆交易');
       localStorage.setItem(KEY,JSON.stringify(draft));showPending();
      }});
     }catch(error){message.textContent=error.message;}
    };
   };
   function filter(){
    const term=input.value.normalize('NFKC').trim().toLowerCase();
    const matches=original.slice(1).filter(option=>{
     const fields=option.textContent.split('｜').slice(1);
     return fields.some(field=>field.normalize('NFKC').toLowerCase().includes(term));
    });
    add.hidden=!term||matches.length>0;
    original[0].textContent=matches.length?'請選擇相符藥品':'查無符合的藥品';
    select.replaceChildren(original[0],...matches);
    select.value=matches.some(option=>option.value===committed)?committed:'';
    select.size=Math.max(2,Math.min(6,matches.length+1));
   }
   function close(){
    add.hidden=true;
    input.value='';
    original[0].textContent='請選擇相符藥品';
    select.replaceChildren(...original);
    select.value=committed;
    select.size=1;
   }
   input.onfocus=filter;
   input.oninput=filter;
   picker.onfocusout=event=>{if(panel.hidden&&!picker.contains(event.relatedTarget))close();};
   input.onkeydown=event=>{
    if(event.isComposing)return;
    if(event.key==='Escape'){close();input.blur();}
    if(event.key==='ArrowDown'){event.preventDefault();select.focus();}
   };
  });
  root.querySelectorAll('[data-qty]').forEach(el=>el.oninput=()=>{const line=recognized.find(x=>x.id===el.dataset.qty);line.quantity=el.value;line.reviewed=false;root.querySelector('[data-reviewed="'+line.id+'"]').checked=false;updatePhotoReviewCount(root,recognized);});
  root.querySelectorAll('[data-photo-price]').forEach(el=>el.oninput=()=>{recognized.find(x=>x.id===el.dataset.photoPrice).price=el.value;});
  root.querySelectorAll('[data-reviewed]').forEach(el=>el.onchange=()=>{recognized.find(x=>x.id===el.dataset.reviewed).reviewed=el.checked;updatePhotoReviewCount(root,recognized);});
  root.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{recognized.find(x=>x.id===el.dataset.remove).removed=true;drawResult();drawBasket();});
  quantitySteppers(root,'[data-qty]');
  $('#ai-add').disabled=(!editing&&!list.length)||!catalogReady||loading;
 }
 function editBatch(batch){
  if(submission)return;
  editing=batch;selected=batch.brand;recognized=structuredClone(batch.recognized);scanPhoto=batch.file;
  $('#ai-image').value='';pastedImage=scanPhoto;displayPhoto(scanPhoto);
  drawBrandButtons([...new Set(sources.map(s=>s.brand))]);drawResult();drawBasket();
  $('#ai-image-hint').textContent='已保留原照片，可直接修改辨識品項。';
  $('#ai-result').focus?.();
 }
 function drawBasket(){
  if(!alive)return;
  $('#ai-basket').innerHTML=basket.length?'<div class="tablewrap"><table><thead><tr><th>藥品</th><th>原庫存</th><th>本次進貨</th><th>預估庫存</th><th>修改</th></tr></thead><tbody>'+
  basket.map((line,i)=>{const r=rows.find(x=>x.name===line.sheet&&x.code===line.code&&x.drug===line.name);return '<tr><td>'+esc(line.sheet+' '+line.code+' '+line.name)+'</td><td>'+esc(r?.bottles??'待更新')+'</td><td>'+fmt(line.quantity)+'</td><td>'+esc(r?fmt(r.bottles+line.quantity):'待更新')+'</td><td><button type="button" class="secondary small" data-basket-remove="'+i+'" '+(recognized.length||submission?'disabled':'')+'>移除</button></td></tr>';}).join('')+'</tbody></table></div>':'<p class="muted">尚未加入品項。可依序上傳多張照片，將品項累積到同一進貨清單。</p>';
  $('#ai-scan').disabled=loading||!!submission;
  $('#ai-add').textContent=editing?'更新本張核對內容':'核對後加入進貨清單';
  if(batches.length)$('#ai-basket').insertAdjacentHTML('beforeend',batches.map((batch,i)=>'<button type="button" class="secondary" data-edit-photo="'+i+'" '+(recognized.length||submission?'disabled':'')+'>修改第 '+(i+1)+' 張 · '+esc(batch.brand)+'</button>').join(''));
  root.querySelectorAll('[data-edit-photo]').forEach(b=>b.onclick=()=>editBatch(batches[Number(b.dataset.editPhoto)]));
  root.querySelectorAll('[data-basket-remove]').forEach(b=>b.onclick=()=>{if(recognized.length||submission)return;
   const key=basket[Number(b.dataset.basketRemove)].key;
   for(const batch of batches){for(const l of batch.recognized)if(l.basketKey===key)l.removed=true;}
   batches=batches.filter(batch=>batch.recognized.some(l=>!l.removed));basket=basket.filter(l=>l.key!==key);drawBasket();});
  $('#ai-preview').disabled=loading||!basket.length||(editing!==null||recognized.some(line=>!line.removed));
 }
 $('#ai-source').onclick=event=>{const button=event.target.closest('[data-ai-brand]');if(!button||loading||button.dataset.aiBrand===selected)return;if(editing){status('請先更新本張核對內容，再切換廠商。');return;}selected=button.dataset.aiBrand;recognized=[];scanPhoto=null;displayPhoto(null);
  drawBrandButtons([...new Set(sources.map(source=>source.brand))]);drawResult();drawBasket();
  status('已讀取 '+selected+' 共 '+currentRows().length+' 項；100g 品項只比對單方。');};
 $('#ai-reload').onclick=async()=>{try{if(directEnabled())await authorize();await load({fresh:true});}catch(error){status(error.message);}};

 $('#ai-image').onchange=()=>{pastedImage=null;$('#ai-image-hint').textContent='也可選取此欄位後貼上圖片。';};
 $('#ai-image').onpaste=event=>{
  const image=[...(event.clipboardData?.files||[])].find(file=>file.type.startsWith('image/'));
  if(!image)return;
  event.preventDefault();
  $('#ai-image').value='';pastedImage=image;
  $('#ai-image-hint').textContent='已貼上圖片，可開始辨識。';
 };
 $('#ai-scan').onclick=async()=>{
  if(loading||submission)return;
  if(editing){status('請先更新本張核對內容，再辨識下一張。');return;}
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
   recognized=cleanRecognized(result);scanPhoto=file;displayPhoto(file);
   for(const line of recognized){
    const match=matchLine(line);
    if(match.row){line.selected=String(match.row.id);line.reviewed=true;}
   }
   if(!recognized.length)throw Error('AI 未辨識到藥品項目，請重拍或改用一般進貨登錄');
   drawResult();drawBasket();status('AI 辨識 '+recognized.length+' 項；'+photoModelLabel(result)+'；唯一配對已勾選，請核對瓶數並處理待配對品項。');
  }catch(error){status(error.message);}finally{lockBusy(false);}
 };
 $('#ai-add').onclick=()=>{
  try{
   if(submission)throw Error('請先核對已送出的本筆進貨。');
   if(!catalogReady||loading)throw Error('請等待完整名冊及辨識載入完成');
   if(!scanPhoto)throw Error('請先辨識照片');
   const batch={brand:selected,file:scanPhoto,recognized:structuredClone(recognized)};
   for(const line of batch.recognized.filter(l=>!l.removed)){
    const [item]=addToBasket([], [line],currentRows(),selected);
    const row=currentRows().find(r=>String(r.id)===line.selected);
    const cents=priceCents(line.price??(row.unitPriceCents==null?'':row.unitPriceCents/100));
    line.price??=cents===undefined?'':String(cents/100);
    line.basketKey=item.key;line.item={...item,unitPriceCents:cents};
   }
   const next=editing?batches.map(old=>old===editing?batch:old):[...batches,batch];
   basket=photoBasket(next);
   batches=next.filter(photo=>photo.recognized.some(l=>!l.removed));editing=null;recognized=[];scanPhoto=null;pastedImage=null;displayPhoto(null);$('#ai-image').value='';$('#ai-image-hint').textContent='也可選取此欄位後貼上圖片。';drawResult();drawBasket();status('已加入清單；尚未同步。可切換廠商再拍下一張照片。');
  }catch(error){status(error.message);}
 };
 function showPending(){
  if(!alive)return;
  try{pending=JSON.parse(localStorage.getItem(KEY)||'null');}catch{pending=null;}
  const unresolved=pending&&pending.kind==='tcm-cloud'&&!pending.verified;
  $('#ai-pending').innerHTML=unresolved?'<h3>上次有一筆待核對交易</h3><p>交易編號：'+esc(pending.id)+'</p><p class="muted">為防止重複入庫，在讀回或以同一交易重試前，不能建立另一筆新進貨。</p><button type="button" id="ai-retry" class="secondary">使用原交易重新核對</button><button type="button" id="ai-readback" class="secondary">查詢 Google 交易紀錄</button>'+(pending.action==='進貨'&&!pending.photoSubmitted?'<button type="button" id="ai-discard" class="secondary">取消未入帳的待核對紀錄</button>':''):'';
  if(unresolved){
   $('#ai-retry').onclick=()=>{
    const draft=cloudDraft(pending);
    if(draft.action!=='建檔')return send(draft,true);
    directReview(draft,ask,async()=>{
     const catalog=await loadReceiptCatalog({fresh:true}),item=draft.lines[0];
     if(!catalog.rows.some(row=>row.name===item.sheet&&row.code===item.code&&row.drug===item.name))throw Error('尚未讀回建檔品項');
     if(JSON.parse(localStorage.getItem(KEY)||'null')?.id===draft.id)localStorage.setItem(KEY,JSON.stringify({...draft,verified:true}));
     showPending();
    },status);
   };
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
      localStorage.removeItem(KEY);if(submission?.id===draft.id)submission=null;
      showPending();status('Google 查無入帳，已取消這筆待核對紀錄並保留本機備份。');
     }catch(error){status(error.message);}
    },'查詢並取消待核對紀錄');
   };
   $('#ai-readback').onclick=async()=>{try{
    const saved=localStorage.getItem(KEY),draft=cloudDraft(JSON.parse(saved));
    await authorize();const event=await lookupPostedTransaction(draft);
    if(!event||JSON.stringify(cloudDraft(event.draft))!==JSON.stringify(draft))throw Error('尚未讀回相同交易，請沿用原交易編號核對');
    finish(draft,saved);status('已查到相同交易的入庫紀錄');
   }catch(error){status(error.message);}};
  }
 }
 function finish(draft,saved){
  if(localStorage.getItem(KEY)===saved)localStorage.setItem(KEY,JSON.stringify({...draft,verified:true}));
  if(submission?.id===draft.id){
   if(submission.basket===basket){basket=[];batches=[];}
   submission=null;
  }
  if(alive){drawBasket();showPending();}
 }
 function send(draft,retry=false){
  if(!directEnabled()){status('目前僅支援經授權的 Google 同步，尚未送出');return;}
  const expected=localStorage.getItem(KEY),snapshot=basket;
  let reserved;
  return directReview(draft,ask,()=>finish(draft,reserved),status,{
   beforeCommit:()=>{
    if(!alive||localStorage.getItem(KEY)!==expected||(!retry&&snapshot!==basket))throw Error('進貨內容已變動，請重新預覽。');
    reserved=JSON.stringify({...draft,photoSubmitted:true});localStorage.setItem(KEY,reserved);
    if(!retry)submission={id:draft.id,basket:snapshot,draft};
    drawBasket();showPending();
   },
   onReturn:!retry?()=>{
    if(!alive||snapshot!==basket||!batches.length)return;
    editBatch(batches[batches.length-1]);
    status('已返回品項核對。修改後按「更新本張核對內容」，即可再次預覽。');
   }:undefined
  });
 }
 $('#ai-preview').onclick=async()=>{
  try{
   if(!basket.length||editing||recognized.some(line=>!line.removed))throw Error('請先完成本張品項核對');
   const saved=localStorage.getItem(KEY),prior=JSON.parse(saved||'null');
   if(submission){
    const sent=submission;
    await authorize();const event=await lookupPostedTransaction(sent.draft);
    if(!alive||sent!==submission)return;
    if(!event||JSON.stringify(cloudDraft(event.draft))!==JSON.stringify(sent.draft))throw Error('上一筆交易結果未明，請先核對原交易');
    finish(sent.draft,prior?.id===sent.id?saved:undefined);status('已讀回上一筆入帳紀錄。');return;
   }
   if(prior&&!prior.verified)throw Error('上一筆交易結果未明，請先核對原交易');
   const draft=cloudDraft({kind:'tcm-cloud',version:2,currency:'TWD',id:'ERP-'+crypto.randomUUID(),action:'進貨',date:$('#ai-date').value,actor:$('#ai-actor').value.trim(),note:noteValue(),lines:basket.map(({sheet,code,name,quantity,unitPriceCents})=>({sheet,code,name,quantity,unitPriceCents}))});
   await send(draft);
  }catch(error){status(error.message);}
 };
 window.addEventListener('erp-synced',onSync);
 drawResult();drawBasket();showPending();load();
 return protectDraft(()=>{alive=false;run++;if(photoUrl)URL.revokeObjectURL(photoUrl);if(catalogDialog.open)catalogDialog.close();window.removeEventListener('erp-synced',onSync);},()=>loading||basket.length>0||recognized.some(line=>!line.removed)||Boolean(pastedImage)||Boolean($('#ai-image')?.files?.length)||Boolean($('#ai-note')?.value?.trim())||Boolean($('#ai-note-other')?.value?.trim()));
}