import {loadSupplierCatalog} from './supplier-catalog.mjs';
import {openMailLoading} from './mail-progress.mjs';
import {createMailSendGate} from './mail-send-gate.mjs';
// Separate gate for print-sheet writes; stays with this app page even if an editor closes.
const printGate=createMailSendGate();
const sharedPrintOutput=Symbol('shared print output');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function openOrderPdfEditor({id,mergeIds=[],rpc,onMail,output='pdf',autoMail=false}){
 const dialog=document.createElement('dialog');dialog.className='pdf-editor';dialog.style.cssText='width:calc(100% - 24px);max-width:1080px;white-space:normal;overflow-wrap:anywhere';dialog.innerHTML=`<style>.pdf-editor .pdf-guild-header{display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-bottom:1px solid #bda267;padding-bottom:14px}.pdf-editor .pdf-guild-header h2{margin:0;border:0;padding:0;flex:1;min-width:180px}.pdf-editor .pdf-slime{position:relative;display:block;width:72px;height:80px;flex:none}.pdf-editor .pdf-slime img{position:relative;z-index:1;width:72px;height:72px;object-fit:contain;transform-origin:50% 90%;animation:pdf-slime-hop 3s ease-in-out infinite}.pdf-editor .pdf-slime::after{content:"";position:absolute;bottom:2px;left:14px;width:44px;height:8px;background:#060d1c;border-radius:50%;opacity:.35;animation:pdf-slime-shadow 3s ease-in-out infinite}@keyframes pdf-slime-hop{0%,62%,100%{transform:translateY(0) scale(1)}68%{transform:translateY(2px) scale(1.09,.9)}78%{transform:translateY(-12px) scale(.96,1.04)}88%{transform:translateY(1px) scale(1.1,.9)}94%{transform:translateY(0) scale(1)}}@keyframes pdf-slime-shadow{0%,62%,100%{transform:scaleX(1);opacity:.35}78%{transform:scaleX(.7);opacity:.18}88%{transform:scaleX(1.12);opacity:.4}}@media(max-width:600px){.pdf-editor .pdf-guild-header{gap:10px}.pdf-editor .pdf-slime{width:56px;height:66px}.pdf-editor .pdf-slime img{width:56px;height:56px}.pdf-editor .pdf-slime::after{left:8px;width:40px}}@media(prefers-reduced-motion:reduce){.pdf-editor .pdf-slime img,.pdf-editor .pdf-slime::after{animation:none!important}}</style><div class="pdf-guild-header"><span class="pdf-slime" aria-hidden="true"><img src="./web/assets/slime-hop.svg" width="72" height="72" alt=""></span><h2>訂藥內容確認與編輯</h2></div><p role="status">正在讀取本次已確認訂單…</p><div data-body></div><div class="actions"><button type="button" data-close>關閉</button></div>`;document.body.append(dialog);dialog.showModal();
 const status=dialog.querySelector('[role=status]'),body=dialog.querySelector('[data-body]'),closeButton=dialog.querySelector('[data-close]');
 const printKeys=[sharedPrintOutput,...new Set([id,...mergeIds])];
 let source,rows=[],brand,stage=1,urls=[],closed=false,busy=false,reviewBusy=false,printBusy=false;const storageKey='erp-order-pdf-draft-v1:'+id+(mergeIds.length?':merge:'+mergeIds.join(','):'');
 let catalog=null,loadingCatalog=false;
 const expanded=new Map();
 function editorSection(kind,title,content){
  return `<details data-section="${kind}" ${expanded.get(brand+'|'+kind)?'open':''}><summary>${title}</summary>${content}</details>`;
 }
 function outputDraft(){
  const draft=snapshot(),lines=draft.rows.filter(r=>!r.catalog);
  for(const add of draft.rows.filter(r=>r.catalog)){
   if(!add.code&&!add.quantity&&!add.search)continue;
   const quantity=Number(add.quantity);
   if(!add.code||!Number.isInteger(quantity)||quantity<1||quantity>1000000)throw Error('請選擇加訂藥品並填寫有效瓶數，或移除未完成的列。');
   const key=add.brand+add.category+'|'+add.code;
   let target=lines.find(r=>r.key===key);
   if(!target){
    const original=source.rows.find(r=>r.key===key);
    target=original?{...original,quantity:0}:{manual:true,key,brand:add.brand,category:add.category,name:add.name+'（'+add.code+'）',quantity:0};
    lines.push(target);
   }
   if(!Number.isInteger(Number(target.quantity))||Number(target.quantity)<0||target.quantity==='')throw Error('請核對原訂單瓶數');
   target.quantity=Number(target.quantity)+quantity;
  }
  return {...draft,rows:lines};
 }
 const snapshot=()=>({sourceHash:source.sourceHash,mergeIds,rows:rows.map(r=>({...r}))});
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(snapshot()));return true;}catch{status.textContent='此瀏覽器無法儲存草稿；請保持視窗開啟，勿重新整理。';return false;}};
 const cleanup=()=>{closed=true;if(source)save();urls.forEach(u=>URL.revokeObjectURL(u));dialog.remove();};closeButton.onclick=()=>{if(!busy||reviewBusy||printBusy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy&&!reviewBusy&&!printBusy)e.preventDefault();});dialog.addEventListener('close',cleanup,{once:true});
 try{source=await rpc('erpOrderPdfEditSource',{id,mergeIds});if(closed)return;rows=source.rows.map(r=>({...r}));brand=source.brands[0];let saved;try{saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}if(saved?.sourceHash===source.sourceHash&&Array.isArray(saved.rows)){rows=saved.rows;status.textContent='已恢復此瀏覽器的 PDF 草稿。';}else{status.textContent=saved?'原訂單已更新，已載入最新內容；舊草稿未套用。':'請核對各廠牌品項與數量，修改只影響 PDF 草稿。';}
 for(const b of source.brands)if(!rows.some(r=>r.manual&&r.brand===b)){rows.push(blank(b),blank(b));}for(const b of source.brands)if(!rows.some(r=>r.catalog&&r.brand===b))rows.push({...blank(b),manual:false,catalog:true});draw();
 }catch(e){if(!closed)status.textContent=e.message;}
 function blank(b){return {manual:true,brand:b,category:'',name:'',quantity:''};}
 function catalogOptions(r){
  const q=(r.search||'').trim().toLowerCase();
  return '<option value="">請選擇藥品</option>'+(catalog||[]).filter(x=>x.brand===r.brand&&(!r.filter||x.category===r.filter)&&x.code&&!x.warning?.includes('編號')&&!(x.name==='科達單方'&&x.code==='QA20261120A')&&(x.code+' '+x.drug).toLowerCase().includes(q)).map(x=>{
   const key=x.name+'|'+x.code;
   return `<option value="${esc(key)}" ${x.code===r.code&&x.category===r.category?'selected':''}>${esc(x.category+'｜'+x.code+'｜'+x.drug)}</option>`;
  }).join('');
 }
 function draw(){
 body.innerHTML=`<style>.pdf-editor details{margin:14px 0;border:1px solid #8094a5;border-radius:6px;padding:10px}.pdf-editor summary{cursor:pointer;color:#fff0be;font-weight:bold;padding:4px}.pdf-editor details table{margin:10px 0}.pdf-editor .pdf-steps{padding:12px 0;color:#f4d48b}.pdf-editor .pdf-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.pdf-editor .pdf-tabs [aria-pressed=true]{background:#cfad5b;color:#172c43}.pdf-editor table{width:100%;table-layout:fixed;white-space:normal;background:#fffaf0;color:#203b55;border-collapse:collapse}.pdf-editor th,.pdf-editor td{text-align:center!important;vertical-align:middle;padding:10px 8px;overflow-wrap:anywhere}.pdf-editor th:nth-child(1){width:14%}.pdf-editor th:nth-child(2){width:40%}.pdf-editor th:nth-child(3){width:30%}.pdf-editor th:nth-child(4){width:16%}.pdf-editor .pdf-stepper{display:grid;grid-template-columns:32px minmax(54px,86px) 32px;align-items:center;justify-content:center;gap:6px}.pdf-editor .pdf-stepper button{padding:0;width:32px;height:36px;min-height:36px;line-height:1}.pdf-editor input,.pdf-editor select{min-width:0;width:100%;font-size:16px}.pdf-editor .pdf-stepper input{text-align:center;padding:8px 2px;height:40px}.pdf-editor [data-remove]{padding:8px;font-size:13px}.pdf-editor small{display:block;color:#536b7d}.pdf-editor .pdf-summary{padding:14px 0}.pdf-editor .pdf-output a{color:#fff0b0}.pdf-editor .pdf-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:18px}.pdf-editor .pdf-manual-heading{margin:20px 0 10px}.pdf-editor [data-add]{margin-top:12px}@media(max-width:600px){.pdf-editor{padding:18px!important}.pdf-editor h2{font-size:20px}.pdf-editor table,.pdf-editor tbody{display:block}.pdf-editor thead{display:none}.pdf-editor tr{display:block;margin:12px 0;padding:8px;border:1px solid #bfa875;border-radius:6px}.pdf-editor td{display:block;border:0;padding:6px}.pdf-editor td::before{content:attr(data-label);display:block;font-size:12px;margin-bottom:5px;color:#536b7d}.pdf-editor .pdf-actions button{flex:1;min-height:44px}.pdf-editor [data-remove]{min-height:40px}.pdf-editor .pdf-stepper button{height:40px;min-height:40px}.pdf-editor .pdf-summary{font-size:14px}}</style><div class="pdf-steps">${stage===1?'① 編輯品項 → ② 核對內容 → ③ 下載／寄送':'① 編輯品項 → ② 核對內容 → ③ 下載／寄送'}</div><p>${esc(source.date)}｜經手人 ${esc(source.actor)}｜單位：瓶</p>${source.merged?`<p style="color:#ffe39b">合併輸出・更新版，取代前版，請勿重複下單</p><p>${source.sources.map(x=>esc(x.date+" · "+x.actor+" · "+x.id)).join("<br>")}</p><p>數量說明：上一筆＋本筆＝原始合計；下方可調整本次輸出數量。</p>`:"<p>單獨輸出本筆訂單</p>"}<div data-stage></div>`;
 const main=body.querySelector('[data-stage]');if(stage!==1)return;
 main.innerHTML=`<div class="pdf-tabs">${source.brands.map(b=>`<button type="button" data-brand="${esc(b)}" aria-pressed="${b===brand}">${esc(b)}</button>`).join('')}</div><h3>${esc(brand)}｜原訂單品項</h3>${table(false)}${editorSection('catalog','加訂原有的藥方',table('catalog')+'<button type="button" class="secondary" data-catalog-add>＋ 新增空白列</button><span data-catalog-state role="status"></span>')}${editorSection('manual','手動新增品項',table(true)+'<button type="button" class="secondary" data-add>＋ 新增空白列</button><p>完全空白列不會列印。</p>')}<p class="pdf-summary" data-summary></p><p>草稿儲存在此瀏覽器；正式訂量與庫存不變更。</p><div class="pdf-actions"><button type="button" class="secondary" data-save>儲存草稿</button><button type="button" data-review>預覽寄出內容 →</button></div>`;
 main.querySelectorAll('[data-section]').forEach(section=>section.ontoggle=async()=>{
  if(!section.isConnected)return;
  expanded.set(brand+'|'+section.dataset.section,section.open);
  if(section.dataset.section!=='catalog'||!section.open||catalog||loadingCatalog)return;
  loadingCatalog=true;main.querySelector('[data-catalog-state]').textContent=' 正在讀取廠商藥品…';
  try{catalog=(await loadSupplierCatalog()).rows;if(!closed&&stage===1&&!busy)draw();}
  catch(e){if(!closed&&stage===1)body.querySelector('[data-catalog-state]').textContent=' '+e.message+'；收合再展開可重試。';}
  finally{loadingCatalog=false;}
 });
 main.querySelector('[data-catalog-add]').onclick=()=>{rows.push({...blank(brand),manual:false,catalog:true});save();draw();};
 main.querySelectorAll('[data-brand]').forEach(b=>b.onclick=()=>{save();brand=b.dataset.brand;draw();});main.querySelector('[data-add]').onclick=()=>{rows.push(blank(brand));save();draw();};main.querySelector('[data-save]').onclick=()=>{if(save())status.textContent='PDF 草稿已儲存在此瀏覽器。';};main.querySelector('[data-review]').onclick=review;
 main.querySelectorAll('[data-row]').forEach(tr=>{const index=Number(tr.dataset.row),r=rows[index];if(r.catalog){
  const picker=tr.querySelector('[data-picker]'),filter=tr.querySelector('[data-filter]'),search=tr.querySelector('[data-search]');
  const refresh=()=>{r.search=search.value;r.filter=filter.value;r.code='';r.name='';r.category='';picker.innerHTML=catalogOptions(r);save();summary();};
  filter.onchange=refresh;search.oninput=refresh;
  picker.onchange=()=>{const item=catalog?.find(x=>x.brand===brand&&x.name+'|'+x.code===picker.value);r.code=item?.code||'';r.name=item?.drug||'';r.category=item?.category||'';save();summary();};
 }for(const field of ['name','category','quantity']){const input=tr.querySelector('[data-field="'+field+'"]');if(input){input.addEventListener('input',()=>{r[field]=input.value;save();summary();});input.addEventListener('change',()=>{r[field]=input.value;save();summary();});}}
 tr.querySelectorAll('[data-adjust]').forEach(b=>b.onclick=()=>{const n=Number(r.quantity)||0;r.quantity=Math.min(1000000,Math.max(1,n+Number(b.dataset.adjust)));tr.querySelector('[data-field=quantity]').value=r.quantity;save();summary();});tr.querySelector('[data-remove]').onclick=()=>{rows.splice(index,1);save();draw();};});summary();
 }
 function table(manual){const list=rows.map((r,i)=>({r,i})).filter(({r})=>r.brand===brand&&(r.catalog?manual==='catalog':r.manual===manual));return `<table><thead><tr><th>類別</th><th>藥品／編號</th><th>預計寄出數量（瓶）</th><th>操作</th></tr></thead><tbody>${list.length?list.map(({r,i})=>`<tr data-row="${i}"><td data-label="類別">${r.catalog?`<select data-filter aria-label="篩選藥品類別"><option value="">全部</option>${['單方','複方'].map(c=>`<option ${r.filter===c?'selected':''}>${c}</option>`).join('')}</select>`:manual?`<select data-field="category" aria-label="手動品項類別"><option value="">選擇類別</option>${['單方','複方'].map(c=>`<option ${r.category===c?'selected':''}>${c}</option>`).join('')}</select>`:esc(r.category)}</td><td data-label="藥品／編號">${r.catalog?`<input data-search aria-label="搜尋名冊" placeholder="輸入編號或藥名" value="${esc(r.search||'')}"><select data-picker aria-label="選擇廠商藥品">${catalogOptions(r)}</select>`:manual?`<input data-field="name" aria-label="手動藥品名稱" maxlength="120" placeholder="輸入藥品名稱" value="${esc(r.name)}">`:`<b>${esc(r.name)}</b><small>${esc(r.code)}</small>${r.parts?`<small>${r.parts.previous} ＋ ${r.parts.current} ＝ ${r.parts.previous+r.parts.current} 瓶</small>`:""}`}</td><td data-label="預計寄出數量（瓶）"><div class="pdf-stepper"><button type="button" class="secondary" data-adjust="-1" aria-label="減少${esc(r.name||'手動品項')}數量">−</button><input data-field="quantity" aria-label="${esc(r.name||'手動品項')}寄出數量" type="number" min="1" max="1000000" step="1" inputmode="numeric" placeholder="數量" value="${esc(r.quantity)}"><button type="button" class="secondary" data-adjust="1" aria-label="增加${esc(r.name||'手動品項')}數量">＋</button></div></td><td><button type="button" class="secondary" data-remove>移除</button></td></tr>`).join(''):'<tr><td colspan="4">目前沒有品項</td></tr>'}</tbody></table>`;}
 function summary(){const list=rows.filter(r=>r.brand===brand&&r.name.trim());body.querySelector('[data-summary]').textContent=`${brand} ${list.length} 項・已填合計 ${list.reduce((n,r)=>n+(Number(r.quantity)||0),0)} 瓶`;}
 async function generatePrint(main,draft,printSnapshot){
  const blocked=printGate.blocked(printKeys);
  if(blocked){
   status.textContent=blocked==='pending'?'本頁已有列印版正在產生；離開不會取消，請勿另開同一共用列印表。':'前一次列印版結果待核對。請先查看既有列印工作表，本頁不會重複產生。';
   return;
  }
  const attempt=printSnapshot&&printGate.begin(printKeys,printSnapshot);
  if(!attempt){status.textContent='列印狀態已變更，請返回修改並重新核對內容，不要沿用舊預覽。';return;}
  busy=true;printBusy=true;
  const attached=()=>!closed&&dialog.open;
  const controls=main.querySelectorAll('button');
  controls.forEach(b=>b.disabled=true);
  closeButton.textContent='先離開（不取消列印）';
  status.textContent='正在產生列印版；可先離開，列印不會取消。結果確認前請勿重複產生。';
  let printed;
  try{
   const result=await rpc('erpPrintConfirmedOrder',{id,draft});
   if(result?.id!==id||!Array.isArray(result.sheets)||!result.sheets.length||result.sheets.some(s=>!s||typeof s.title!=='string'||typeof s.url!=='string'||!s.url||!Number.isInteger(s.count)||s.count<1))throw Error('回傳的列印結果無法核對。');
   printed=result;printGate.settle(attempt,'complete');
  }catch(e){
   printGate.settle(attempt,'uncertain');
   if(attached())status.textContent='列印結果待核對，請先查看既有列印工作表，不要重複產生。'+(e?.message?' '+e.message:'');
  }finally{
   busy=false;printBusy=false;
   if(attached()){
    closeButton.textContent='關閉';
    controls.forEach(b=>b.disabled=false);
    if(printed)main.querySelector('[data-generate]').disabled=true;
   }
  }
  if(printed&&attached()){
   main.querySelector('.pdf-output').innerHTML=printed.sheets.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener">開啟 ${esc(s.title)}（${s.count} 項）</a></p>`).join('');
   status.textContent=printed.message||'列印版已產生並讀回核對。';
  }
 }
 async function review(){if(busy)return;busy=true;reviewBusy=true;body.querySelectorAll('button,input,select').forEach(x=>x.disabled=true);status.textContent='正在核對草稿與原訂單…';save();try{const draft=outputDraft();const result=await rpc('erpOrderPdfDraftPreview',{id,draft});if(closed)return;stage=2;draw();const main=body.querySelector('[data-stage]');main.innerHTML=result.groups.map(g=>`<h3>${esc(g.brand)}（${g.items.length} 項）</h3><table><thead><tr><th>類別</th><th>藥品／編號</th><th>數量（瓶）</th><th>來源</th></tr></thead><tbody>${g.items.map(r=>`<tr><td data-label="類別">${esc(r.category)}</td><td data-label="藥品／編號">${esc(r.name)}<small>${esc(r.code)}</small></td><td data-label="數量（瓶）">${r.quantity}</td><td>${r.manual?'手動新增':'原訂單'}</td></tr>`).join('')}</tbody></table>`).join('')+'<p>確認以下內容後才會產生 PDF；正式訂量與庫存不變更。</p><div class="pdf-actions"><button type="button" class="secondary" data-back>返回修改</button><button type="button" data-generate>確認內容並產生' + (output==='print'?'列印版':autoMail?'PDF，下一步選擇收件人':'PDF') + '</button></div><div class="pdf-output"></div>';
 const printSnapshot=output==='print'&&!printGate.blocked(printKeys)?printGate.snapshot(printKeys):null;
 main.querySelector('[data-back]').onclick=()=>{urls.forEach(u=>URL.revokeObjectURL(u));urls=[];stage=1;draw();status.textContent='返回編輯；修改後請重新核對並產生 PDF。';};main.querySelector('[data-generate]').onclick=async()=>{if(busy)return;if(output==='print')return generatePrint(main,draft,printSnapshot);busy=true;main.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='正在依修訂內容產生 PDF…';const loading=openMailLoading('pdf');try{const response=await loading.wait(rpc('erpOrderPdfDownload',{id,draft}));if(response.left){if(!closed)status.textContent='已返回；PDF 尚未寄送，可重新產生。';return;}const pdf=response.value;loading.close();if(closed)return;const files=main.querySelector('.pdf-output');files.innerHTML=pdf.files.map(f=>{const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0))],{type:'application/pdf'}));urls.push(url);return `<p><a href="${esc(url)}" download="${esc(f.name)}" target="_blank" rel="noopener">下載 ${esc(f.brand)} PDF（${f.count} 項）</a></p>`;}).join('')+'<button type="button" data-mail-draft>選擇員工寄送這份 PDF</button>';files.querySelector('[data-mail-draft]').onclick=()=>{dialog.close();onMail(draft);};status.textContent=`已依草稿產生 ${pdf.files.length} 份 PDF。`;if(autoMail){dialog.close();await onMail(draft);}}catch(e){status.textContent=e.message;loading?.failure(e);}finally{busy=false;main.querySelectorAll('button').forEach(b=>b.disabled=false);}};status.textContent='內容已核對，請確認預計寄出的品項與數量。';
 }catch(e){if(!closed){status.textContent=e.message;body.querySelectorAll('button,input,select').forEach(x=>x.disabled=false);}}finally{busy=false;reviewBusy=false;}}
}
