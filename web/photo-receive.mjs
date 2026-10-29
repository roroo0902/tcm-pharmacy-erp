import {SOURCES,parseSheet,exportUrl} from './sheets-data.mjs';
import {directEnabled,authorize,runDirect,directSheet,directReview,directLog} from './direct-sync.mjs?v=direct20261029b';
import {cloudDraft} from '../src/cloud-transaction.mjs';
import {csvRows} from './sheets-data.mjs';
import {matchRecognized,cleanRecognized,addToBasket} from '../src/photo-receive-data.mjs';
const KEY='tcm-cloud-pending-v1';
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

export function mountPhotoReceive({esc,fmt,ask}){
 const root=document.querySelector('#content'),abort=new AbortController();
 let alive=true,run=0,rows=[],recognized=[],basket=[],loading=false,selected=SOURCES[0],pending=null;
 const sources=SOURCES;
 root.innerHTML='<style>.ai-item{background:var(--surface,#fff);border:1px solid #dce3ea;border-radius:12px;padding:14px;margin:12px 0;display:grid;gap:8px}.ai-item label{display:block}.ai-item select,.ai-item input[type=number]{width:100%;max-width:100%;box-sizing:border-box}.ai-item .check-label{display:flex;align-items:center;gap:8px}.ai-item .check-label input{width:auto}</style><section class="panel"><div class="panelhead"><div><h2>AI 拍照進貨</h2><span class="muted">選廠商 → 拍照 → AI 解析 → 人工核對 → 預覽 → 確認入庫</span></div></div>'+
  '<p class="notice">AI 辨識結果只是草稿。必須選到現有藥品並逐項核對，最後會再次讀取 Google 即時庫存；未確認不會修改庫存。</p>'+
  '<div class="grid"><label>廠牌／類別<select id="ai-source"></select></label><label>進貨日期<input type="date" id="ai-date" max="'+todayTaipei()+'" value="'+todayTaipei()+'"></label><label>經手人<input type="text" id="ai-actor" maxlength="80" required placeholder="請輸入經手人"></label><label class="full">單據或備註<input type="text" id="ai-note" maxlength="500"></label><label class="full">拍照或選擇照片<input id="ai-image" type="file" accept="image/*" capture="environment"></label></div>'+
  '<div class="actions"><button type="button" id="ai-scan">AI 解析照片</button><button type="button" class="secondary" id="ai-reload">更新現有藥品</button></div><p id="ai-status" role="status"></p>'+
  '<div id="ai-result"></div><div class="actions"><button type="button" id="ai-add" disabled>核對後加入進貨清單</button></div><h3>本次進貨清單（尚未入庫）</h3><div id="ai-basket"></div><div class="actions"><button type="button" id="ai-preview" disabled>預覽庫存變化並確認同步</button></div><section id="ai-pending"></section></section>';
 const $=sel=>root.querySelector(sel);
 const status=text=>{if(alive)$('#ai-status').textContent=text;};
 const lockBusy=busy=>{loading=busy;$('#ai-scan').disabled=busy;$('#ai-reload').disabled=busy;};
 $('#ai-source').innerHTML=sources.map(s=>'<option value="'+esc(s.name)+'">'+esc(s.brand)+'｜'+esc(s.category)+'</option>').join('');
 function currentRows(){return rows.filter(r=>r.name===selected.name);}
 async function load(){
  const seq=++run;status('正在讀取 '+selected.name+' 的最新藥品…');
  try{
   const response=directEnabled()?await directSheet(selected,abort.signal):await fetch(exportUrl(selected),{cache:'no-store',signal:abort.signal});
   if(!response.ok||!response.headers.get('content-type')?.includes('text/csv'))throw Error('讀取藥品清單失敗，請先登入 Google');
   const next=parseSheet(await response.text(),selected);
   if(seq!==run||!alive)return;
   rows=next;status('已讀取 '+selected.name+' 共 '+next.length+' 項；AI 比對只使用此分頁。');
  }catch(error){if(seq===run&&alive){rows=[];status(error.message);}}
 }
 const matchLine=(line)=>matchRecognized(line,currentRows());
 function drawResult(){
  if(!alive)return;
  const options=currentRows().map(r=>'<option value="'+esc(String(r.id))+'">'+esc(r.code+'｜'+r.drug)+'</option>').join('');
  const list=recognized.filter(x=>!x.removed);
  $('#ai-result').innerHTML=!list.length?'<p class="muted">辨識後，這裡會顯示每一筆藥名、數量及配對結果。</p>':'<h3>核對辨識結果</h3><p class="muted">請核對藥名、規格及數量。若照片標示為盒、袋、包等，請在「實際入庫瓶數」填正確換算後數量，不直接將 AI 數字入庫。</p>'+
  list.map(line=>{const m=matchLine(line);if(!line.selected&&m.row)line.selected=String(m.row.id);
   const found=currentRows().find(r=>String(r.id)===line.selected);
   return '<div class="ai-item"><div><b>'+esc(line.name||'未讀出藥名')+'</b><span class="muted">　原始編號 '+esc(line.code||'未讀出')+'</span></div>'+
    '<p class="muted">原照片：'+esc(line.evidence||'無可核對文字')+'；辨識數量 '+esc(line.quantity||'不明')+' '+esc(line.unit||'單位不明')+'；AI 自評 '+esc(line.confidence)+'</p>'+
    '<label>選擇現有庫存藥品<select data-select="'+line.id+'"><option value="">請選擇相符藥品</option>'+options+'</select></label>'+
    '<label>實際入庫瓶數<input data-qty="'+line.id+'" type="number" min="1" max="1000000" step="1" inputmode="numeric" value="'+esc(line.quantity)+'"></label>'+
    '<p class="muted">'+esc(m.reason)+'；'+esc(unitMessage(line.unit))+(found?'；現庫存 '+esc(found.bottles??'待核對')+' 瓶':'')+'</p>'+
    '<label class="check-label"><input data-reviewed="'+line.id+'" type="checkbox" '+(line.reviewed?'checked':'')+'>已逐項核對藥名、編號、進貨單位及實際瓶數</label>'+
    '<button type="button" data-remove="'+line.id+'" class="secondary small">不列入此項</button></div>';
  }).join('');
  root.querySelectorAll('[data-select]').forEach(el=>{const line=recognized.find(x=>x.id===el.dataset.select);el.value=line.selected;el.onchange=()=>{line.selected=el.value;line.reviewed=false;drawResult();};});
  root.querySelectorAll('[data-qty]').forEach(el=>el.oninput=()=>{const line=recognized.find(x=>x.id===el.dataset.qty);line.quantity=el.value;line.reviewed=false;root.querySelector('[data-reviewed="'+line.id+'"]').checked=false;});
  root.querySelectorAll('[data-reviewed]').forEach(el=>el.onchange=()=>{recognized.find(x=>x.id===el.dataset.reviewed).reviewed=el.checked;});
  root.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{recognized.find(x=>x.id===el.dataset.remove).removed=true;drawResult();});
  $('#ai-add').disabled=!list.length;
 }
 function drawBasket(){
  $('#ai-basket').innerHTML=basket.length?'<div class="tablewrap"><table><thead><tr><th>藥品</th><th>原庫存</th><th>本次進貨</th><th>預估庫存</th><th>修改</th></tr></thead><tbody>'+
  basket.map((line,i)=>{const r=rows.find(x=>x.name===line.sheet&&x.code===line.code&&x.drug===line.name);return '<tr><td>'+esc(line.sheet+' '+line.code+' '+line.name)+'</td><td>'+esc(r?.bottles??'待更新')+'</td><td>'+fmt(line.quantity)+'</td><td>'+esc(r?fmt(r.bottles+line.quantity):'待更新')+'</td><td><button type="button" class="secondary small" data-basket-remove="'+i+'">移除</button></td></tr>';}).join('')+'</tbody></table></div>':'<p class="muted">尚未加入品項。可依序上傳多張照片，將品項累積到同一進貨清單。</p>';
  root.querySelectorAll('[data-basket-remove]').forEach(b=>b.onclick=()=>{basket.splice(Number(b.dataset.basketRemove),1);drawBasket();});
  $('#ai-preview').disabled=!basket.length;
 }
 $('#ai-source').onchange=()=>{selected=sources.find(s=>s.name===$('#ai-source').value)||sources[0];recognized=[];drawResult();load();};
 $('#ai-reload').onclick=async()=>{try{if(directEnabled())await authorize();await load();}catch(error){status(error.message);}};
 $('#ai-scan').onclick=async()=>{
  if(loading)return;
  try{
   if(!directEnabled())throw Error('AI 拍照功能需要已授權的 Google 雲端入口');
   if(!rows.length)throw Error('請先完成此廠商的藥品清單讀取');
   const file=$('#ai-image').files[0];if(!file)throw Error('請先上傳照片');
   const scanSheet=selected.name;
   lockBusy(true);status('正在壓縮照片、辨識藥名與數量…');
   await authorize();const base64=await jpegData(file);
   const result=await runDirect('recognizeReceipt',{sheet:scanSheet,mimeType:'image/jpeg',base64});
   if(!alive||selected.name!==scanSheet){status('已切換廠商，上一張照片的辨識結果未套用。');return;}
   // Do not persist the image or raw API response in localStorage.
   recognized=cleanRecognized(result);
   if(!recognized.length)throw Error('AI 未辨識到藥品項目，請重拍或改用一般進貨登錄');
   for(const line of recognized){const m=matchLine(line);line.selected=m.row?String(m.row.id):'';}
   drawResult();status('AI 辨識 '+recognized.length+' 項；請逐項比對，並由人工勾選核對。');
  }catch(error){status(error.message);}finally{lockBusy(false);}
 };
 $('#ai-add').onclick=()=>{
  try{
   const active=recognized.filter(x=>!x.removed);const next=addToBasket(basket,active,currentRows(),selected.name);
   basket=next;recognized=[];$('#ai-image').value='';drawResult();drawBasket();status('已加入清單；尚未同步。可切換廠商再拍下一張照片。');
  }catch(error){status(error.message);}
 };
 function showPending(){
  try{pending=JSON.parse(localStorage.getItem(KEY)||'null');}catch{pending=null;}
  const unresolved=pending&&pending.kind==='tcm-cloud'&&!pending.verified;
  $('#ai-pending').innerHTML=unresolved?'<h3>上次有一筆待核對交易</h3><p>交易編號：'+esc(pending.id)+'</p><p class="muted">為防止重複入庫，在讀回或以同一交易重試前，不能建立另一筆新進貨。</p><button type="button" id="ai-retry" class="secondary">使用原交易重新核對</button><button type="button" id="ai-readback" class="secondary">查詢 Google 交易紀錄</button>':'';
  if(unresolved){
   $('#ai-retry').onclick=()=>send(cloudDraft(pending));
   $('#ai-readback').onclick=async()=>{try{await authorize();const response=await directLog('inventory');const record=csvRows(await response.text()).slice(1).find(r=>r[0]===pending.id);if(!record)throw Error('未發現該交易；請沿用原交易編號重新核對');const stored=JSON.parse(record[1]).draft;if(JSON.stringify(cloudDraft(stored))!==JSON.stringify(cloudDraft(pending)))throw Error('同編號內容與雲端不一致，請停止操作');localStorage.setItem(KEY,JSON.stringify({...pending,verified:true}));showPending();status('已查到相同交易的入庫紀錄');}catch(error){status(error.message);}};
  }
 }
 function send(draft){
  if(!directEnabled()){status('目前僅支援經授權的 Google 同步，尚未送出');return;}
  directReview(draft,ask,async()=>{
   localStorage.setItem(KEY,JSON.stringify({...draft,verified:true}));basket=[];drawBasket();showPending();await load();
  },status);
 }
 $('#ai-preview').onclick=()=>{
  try{
   if(!basket.length)throw Error('請先加入進貨清單');
   if(basket.some(x=>x.sheet!==selected.name)){
    // Cross-vendor batches are allowed; the server validates each existing item again.
   }
   const prior=JSON.parse(localStorage.getItem(KEY)||'null');
   if(prior&&!prior.verified)throw Error('上一筆交易結果未明，請先核對原交易');
   const draft=cloudDraft({kind:'tcm-cloud',version:1,id:'ERP-'+crypto.randomUUID(),action:'進貨',date:$('#ai-date').value,actor:$('#ai-actor').value.trim(),note:$('#ai-note').value.trim(),lines:basket.map(({sheet,code,name,quantity})=>({sheet,code,name,quantity}))});
   // Persist the ID and exact draft before preview to keep retries idempotent.
   localStorage.setItem(KEY,JSON.stringify(draft));showPending();send(draft);
  }catch(error){status(error.message);}
 };
 window.addEventListener('erp-synced',load);
 drawResult();drawBasket();showPending();load();
 return()=>{alive=false;run++;abort.abort();window.removeEventListener('erp-synced',load);};
}