import {receiptLabel} from './receipt-label.mjs';
import {markCatalogWrite} from './catalog-events.mjs';
import {orderAddMarkup,bindOrderAdd} from './order-add.mjs';
import {receiptAddMarkup,bindReceiptAdd} from './receipt-review-add.mjs';
import {orderPrintControl,bindOrderPrint} from './order-print.mjs';
import {lossCompletionPreview,assertLossCompletion} from './loss-unified.mjs';
import {beginProcessing,isProcessing} from './processing-screen.mjs';
import {DIRECT} from './direct-config.mjs';
export const hostedEnabled=()=>!!globalThis.google?.script?.run;
export const directEnabled=()=>hostedEnabled()||(DIRECT.enabled&&!!DIRECT.clientId&&!!DIRECT.deploymentId);
const scopes=['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/script.container.ui','https://www.googleapis.com/auth/userinfo.email'];
let token='',expires=0,client,signing;
let snapshotRequest,writing=false,reviewSequence=0;
export const directPollMs=()=>DIRECT.pollMs;
export function setupDirect(){
 if(!directEnabled())return;
 if(hostedEnabled()){
  document.querySelector('.notice').textContent='Google Sheets 為正式庫存；在本頁預覽並確認後直接入帳，完成後自動讀回。訂貨不增加庫存。';
  document.querySelector('.sidefoot small').textContent='Google 已登入・站內確認後直接同步';
  return;
 }
 const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
 document.head.append(script);
 const button=document.createElement('button');button.id='google-connect';button.textContent='登入 Google 同步';
 const notice=document.querySelector('.notice');notice.textContent='Google Sheets 為唯一正式庫存；在站內核對後按「確認入帳」直接同步。訂貨不增加庫存。';notice.append(button);
 const foot=document.querySelector('.sidefoot small');if(foot)foot.textContent='正式帳務儲存於 Google Sheets；站內核對後直接同步';
 button.onclick=()=>authorize().then(()=>{button.textContent='Google 已連線';window.dispatchEvent(new CustomEvent('erp-synced',{detail:{connected:true}}));}).catch(e=>{button.textContent=e.message;});
}
export function authorize(){
 if(hostedEnabled())return Promise.resolve();
 if(token&&Date.now()<expires)return Promise.resolve();
 if(signing)return signing;
 if(!directEnabled())return Promise.reject(Error('站內同步尚未完成部署設定'));
 if(!globalThis.google?.accounts?.oauth2)return Promise.reject(Error('Google 登入元件尚未載入，請稍後重試'));
 signing=new Promise((resolve,reject)=>{
  const fail=e=>{signing=null;reject(Error(e.error_description||e.message||'Google 登入未完成'));};
  client=google.accounts.oauth2.initTokenClient({client_id:DIRECT.clientId,scope:scopes.join(' '),callback:r=>{
   if(r.error)return fail(r);
   if(!google.accounts.oauth2.hasGrantedAllScopes(r,...scopes))return fail({message:'尚未授權所有必要權限'});
   token=r.access_token;expires=Date.now()+(Number(r.expires_in)-60)*1000;signing=null;resolve();
  },error_callback:fail});client.requestAccessToken({prompt:''});
 });return signing;
}
export async function runDirect(operation,draft,previewToken){
 if(hostedEnabled()){
  const call=(op)=>new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e.message||'同步失敗，請重新核對同一筆資料'))).erpHosted(op,draft??null,previewToken??null));
  // Separate executions avoid SpreadsheetApp stale caches after adding a date column.
  if(operation==='preview'&&draft?.kind==='tcm-loss-cumulative')await call('prepareLoss');
  return call(operation);
 }
 if(!token||Date.now()>=expires)throw Error('請先點「登入 Google 同步」重新連線；輸入仍保留');
 if(operation==='preview'&&draft?.kind==='tcm-loss-cumulative')await runDirect('prepareLoss',draft);
 const response=await fetch('https://script.googleapis.com/v1/scripts/'+encodeURIComponent(DIRECT.deploymentId)+':run',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({function:'erpDirect',parameters:[operation,draft??null,previewToken??null],devMode:false})
 });
 if(response.status===401){token='';expires=0;}
 const result=await response.json();
 if(!response.ok||result.error)throw Error(result.error?.details?.[0]?.errorMessage||result.error?.message||'同步失敗；請以同一交易重新核對，勿重複建立');
 if(!result.done||!result.response||!Object.hasOwn(result.response,'result'))throw Error('結果未明，請以同一交易重新核對');
 return result.response.result;
}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const priceMoney=c=>'NT$ '+(c/100).toLocaleString('zh-TW',{minimumFractionDigits:0,maximumFractionDigits:2});
const priceCells=(l,order=false)=>`<td data-label="單價（元／瓶）">${l.unitPriceCents===undefined?'未提供':priceMoney(l.unitPriceCents)}</td><td data-label="${order?'訂貨小計（元）':'小計（元）'}">${l.unitPriceCents===undefined?'—':priceMoney(l.unitPriceCents*l.quantity)}</td>`;
function priceChange(line){
 if(line.priceAfter===undefined)return '';
 const oldPrice=String(line.priceBefore??'').trim();
 const numericPrice=oldPrice.replace(/^(?:NT\$|\$)\s*/i,'').replace(/,/g,'');
 if(numericPrice&&Number(numericPrice)===line.priceAfter)return '';
 return `<li>${escape(line.sheet)} ${escape(line.name)}：${escape(oldPrice||'未提供')} → ${priceMoney(line.unitPriceCents)}</li>`;
}
function priceTotal(lines,order=false){const missing=lines.filter(l=>l.unitPriceCents===undefined).length,total=lines.reduce((n,l)=>n+(l.unitPriceCents??0)*l.quantity,0);return `<p class="price-total">${missing?'已填單價小計':order?'訂貨金額合計':'進貨金額合計'}：${priceMoney(total)}${missing?'（'+missing+' 項未提供單價）':''}</p>`;}
const matchingReceiptLink=(draft,line)=>draft.shortageLinks?.find(a=>a.sheet===line.sheet&&a.code===line.code);
const receiptLinkKey=a=>JSON.stringify([a.shortageId,a.sheet,a.code]);
function partialReceiptLinkKeys(draft){
 return new Set((draft.shortageLinks||[]).filter(a=>draft.lines.some(l=>l.sheet===a.sheet&&l.code===a.code&&a.quantity<l.quantity)).map(receiptLinkKey));
}
export function revisedReceipt(draft,previewLines,values,partialLinks=partialReceiptLinkKeys(draft)){
 if(draft.kind!=='tcm-cloud'||draft.action!=='進貨')throw Error('僅支援進貨數量修改');
 if(values.length!==previewLines.length||values.length!==draft.lines.length)throw Error('品項數量不一致，請重新核對');
 const next=JSON.parse(JSON.stringify(draft)),seen=new Set();
 previewLines.forEach((line,i)=>{
  const n=Number(values[i]);if(String(values[i]).trim()===''||!Number.isInteger(n)||n<1||n>1000000)throw Error('進貨數量須為 1 到 1000000 的整數');
  const matches=next.lines.filter(l=>l.sheet===line.sheet&&l.code===line.code&&l.name===line.name);
  if(matches.length!==1||seen.has(matches[0]))throw Error('品項不一致，請重新核對');
  const item=matches[0],link=matchingReceiptLink(next,item);
  if(link)link.quantity=!partialLinks.has(receiptLinkKey(link))&&link.quantity===item.quantity?n:Math.min(link.quantity,n);
  seen.add(item);item.quantity=n;
 });return next;
}
function receiptEditor(reviewed,preview,onChange,partialLinks){
 const root=document.querySelector('#confirm-detail'),inputs=[...root.querySelectorAll('[data-review-qty]')],commit=document.querySelector('#commit');
 const read=()=>revisedReceipt(reviewed,preview.lines,inputs.map(el=>el.value),partialLinks);
 const update=()=>{
  try{
   const next=read(),changed=next.lines.some((l,i)=>l.quantity!==reviewed.lines[i].quantity);
   inputs.forEach((input,i)=>{const row=input.closest('tr'),l=preview.lines[i],n=Number(input.value);row.querySelector('[data-label="入帳後庫存"]').textContent=String(l.before+n);if(l.unitPriceCents!==undefined)row.querySelector('[data-label="小計（元）"]').textContent=priceMoney(l.unitPriceCents*n);const link=matchingReceiptLink(next,l),label=row.querySelector('[data-receipt-link]');if(link&&label)label.textContent='缺藥關聯 '+link.quantity+' 瓶';});
   root.querySelector('.price-total').outerHTML=priceTotal(preview.lines.map((l,i)=>({...l,quantity:Number(inputs[i].value)})));
   commit.textContent=changed?'重新核對數量':'確認入帳';
   root.querySelector('[data-review-note]').textContent=(changed?'數量已修改；請重新核對最新庫存後再確認入帳。':'可直接加減數量；修改後需要重新核對，尚未入帳。')+(next.shortageLinks?.length?' 請一併核對本次實收與缺藥關聯量。':'');
   onChange(next);
  }catch(e){commit.textContent='重新核對數量';root.querySelector('[data-review-note]').textContent=e.message;}
 };
 inputs.forEach(input=>input.addEventListener('input',update));
 root.querySelectorAll('[data-review-step]').forEach(b=>b.onclick=()=>{const input=inputs[Number(b.dataset.reviewIndex)],value=Number(input.value);if(!Number.isInteger(value))return;input.value=String(Math.min(1000000,Math.max(1,value+Number(b.dataset.reviewStep))));update();});
 return read;
}
export async function directReview(draft,ask,onSuccess,status,options={}){
 if(writing||isProcessing()){status('上一筆仍在處理，請稍候');return;}
 const sequence=++reviewSequence;let readingScreen;
 try{
  await authorize();readingScreen=beginProcessing({reading:true});status('正在讀取最新雲端資料…');
  const reviewed=JSON.parse(JSON.stringify(draft));
  const preview=await runDirect('preview',reviewed);
  if(sequence!==reviewSequence)return;
  if(options.requireUnposted&&preview.duplicate)throw Error(reviewed.action==='訂貨'?'上一筆已同步。請再查一次同步結果。':'上一筆已入帳。請再查一次入帳結果。');
  if(reviewed.completionSheets)assertLossCompletion(reviewed,preview.completion,false);
  if(reviewed.version===2&&reviewed.kind==='tcm-cloud')for(const l of reviewed.lines){const p=preview.lines.find(p=>p.sheet===l.sheet&&p.code===l.code&&p.name===l.name);if(!p||p.quantity!==l.quantity||p.unitPriceCents!==l.unitPriceCents||(l.unitPriceCents!==undefined&&p.amountCents!==l.unitPriceCents*l.quantity))throw Error('單價預覽不一致，請重新載入最新版再核對，尚未入帳');}
  readingScreen.close();readingScreen=null;
  const order=['訂貨','取消訂貨'].includes(reviewed.action),priced=reviewed.kind==='tcm-cloud'&&['進貨','沖銷','訂貨','取消訂貨'].includes(reviewed.action),priceHead=priced?'<th>單價（元／瓶）</th><th>'+(order?'訂貨小計（元）':'小計（元）')+'</th>':'';
  const loss=reviewed.kind==='tcm-loss-cumulative',editable=reviewed.kind==='tcm-cloud'&&reviewed.action==='進貨'&&typeof options.onDraftChange==='function';let readEdited;
  // Keep originally partial allocations partial throughout this review; never persist review metadata.
  if(editable&&!options.receiptLinkBasis)options={...options,receiptLinkBasis:partialReceiptLinkKeys(reviewed)};
  const quantityCell=(l,i)=>editable?`<div class="review-quantity"><button type="button" data-review-step="-1" data-review-index="${i}" aria-label="${escape(l.code)} 減少一瓶">−</button><input data-review-qty type="number" min="1" max="1000000" step="1" required inputmode="numeric" aria-label="${escape(l.sheet+' '+l.code+' '+l.name)} 確認進貨數量" value="${escape(l.quantity)}"><button type="button" data-review-step="1" data-review-index="${i}" aria-label="${escape(l.code)} 增加一瓶">＋</button></div>`:escape(l.quantity??l.total);
  const linkedQuantity=l=>{const a=reviewed.action==='進貨'&&matchingReceiptLink(reviewed,l);return a?'<small class="muted" data-receipt-link>缺藥關聯 '+escape(a.quantity)+' 瓶</small>':'';};
  const forecast=reviewed.action==='訂貨';
  const stockHeading=forecast?'入帳後預計庫存':'入帳後庫存';
  const projectedStock=line=>Number.isFinite(line.before)&&Number.isFinite(line.quantity)?line.before+line.quantity:'待核對';
  const lines=preview.lines.map((l,i)=>`<tr><td data-label="藥品">${escape(l.sheet)} ${escape(l.code)} ${escape(l.name)}${l.create?'<br><small>新建檔・期初 0 瓶</small>':l.manual?'<br><small>手動新增・僅訂貨，不異動庫存</small>':''}</td><td data-label="${loss?'新累計':reviewed.action==='進貨'?'本次實收':forecast?'本次訂貨數量':'數量'}">${quantityCell(l,i)}${linkedQuantity(l)}</td><td data-label="${loss?'原累計':'原庫存'}">${escape(l.before)}</td><td data-label="${stockHeading}">${escape(forecast?projectedStock(l):(l.after??l.stockAfter))}</td>${priced?priceCells(l,order):''}</tr>`).join('');
  const weeklyChanges=preview.lines.filter(line=>line.orderAfter!==undefined).map(line=>{
   if(forecast)return `<li><strong>${escape(line.sheet)}｜${escape(line.name||line.code)}</strong><br>本周訂貨：${escape(line.orderAfter)} 瓶｜到貨後預計庫存：${escape(projectedStock(line))}${Number.isFinite(line.before)?' 瓶':''}</li>`;
   const before=String(line.orderBefore??'').trim();
   const after=String(line.orderAfter??'').trim();
   const quantityLabel=value=>value===''?'空白':' '+escape(value)+' 瓶';
   const same=before===after;
   return `<li><strong>${escape(line.sheet)}｜${escape(line.name||line.code)}</strong><br>本周訂貨量：原為${quantityLabel(before)}，確認後${same?'仍為':'為'}${quantityLabel(after)}。</li>`;
  }).join('');
  const priceChanges=reviewed.action==='進貨'?preview.lines.map(priceChange).join(''):'';
  const reversalChanges=reviewed.action==='沖銷'?preview.lines.map(line=>{
   const date=value=>value.stringValue??value.formulaValue??(value.numberValue===undefined?'空白':new Date(Date.UTC(1899,11,30)+value.numberValue*86400000).toISOString().slice(0,10));
   const fields=[];
   if(line.priceAfter!==undefined)fields.push('單價 '+(line.priceBefore===''?'空白':line.priceBefore)+' → '+(line.priceAfter===''?'空白':line.priceAfter));
   if(line.updateDateAfter!==undefined)fields.push('更新日期 '+date(line.updateDateBefore)+' → '+date(line.updateDateAfter));
   return fields.length?'<li>'+escape(line.sheet+' '+line.code+' '+line.name+'：'+fields.join('、'))+'</li>':'';
  }).join(''):'';
  const returnFromPreview=options.onReturn && (()=>{
   if(sequence!==reviewSequence||writing)return;
   reviewSequence++;
   return options.onReturn();
  });
  ask(`${options.reviewIntro?.(reviewed)??''}${editable?'<style>#confirm .review-quantity{display:flex;align-items:center;justify-content:center;gap:6px;min-width:142px}#confirm .review-quantity button{min-width:32px;width:32px;height:36px;min-height:36px;padding:0;font-size:20px}#confirm .review-quantity input{width:66px;min-width:0;height:36px;min-height:36px;margin:0;padding:4px;text-align:center;font-size:16px;color:#172c48;background:#fff}#confirm .direct-review-table td{vertical-align:middle}#confirm .review-add-disclosure{margin-top:24px;border:1px solid #d6b568;border-radius:6px}#confirm .review-add-disclosure>summary{display:flex;align-items:center;gap:10px;min-height:48px;padding:12px 16px;cursor:pointer;list-style:none;color:#fff4d7}#confirm .review-add-disclosure>summary::-webkit-details-marker{display:none}#confirm .review-add-disclosure>summary::after{content:"⌄";margin-left:auto}#confirm .review-add-disclosure[open]>summary::after{content:"⌃"}#confirm .review-add-symbol::before{content:"＋"}#confirm .review-add-disclosure[open] .review-add-symbol::before{content:"−"}#confirm .review-add-disclosure>summary:focus-visible{outline:2px solid #e0c389;outline-offset:3px}#confirm .review-add{margin:0;border:0;border-top:1px solid #d6b568;padding:16px;min-width:0}#confirm .review-add label{display:block;margin-bottom:12px}#confirm .review-add input,#confirm .review-add select{box-sizing:border-box;width:100%;min-width:0}#confirm .review-add-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}#confirm .review-add button{white-space:normal;max-width:100%}#confirm .review-add p{overflow-wrap:anywhere}#confirm .review-add-unit{display:flex;align-items:center;gap:8px}#confirm .review-add-unit input{flex:1;width:0}#confirm .review-add-unit>span{flex:none}@media(max-width:600px){#confirm .review-quantity button{min-height:44px;height:44px}#confirm .review-quantity input{height:44px}}</style><form id="receipt-review-form"><p data-review-note role="status">可直接加減數量；修改後需要重新核對，尚未入帳。'+(reviewed.shortageLinks?.length?' 請一併核對本次實收與缺藥關聯量。':'')+'</p>':''}<p>${escape(reviewed.date)} · ${reviewed.action==='取消訂貨'?'取消原因：'+escape(reviewed.note):escape(reviewed.actor)}</p><p>${loss?'當日累計以差額入帳；原值欄為已登錄累計。':forecast?'預計庫存以本次訂貨全數到貨計算；確認訂貨不增加實際庫存，完成進貨登錄後才會更新。':'請核對數量與庫存。訂貨不增加庫存。'}</p><div class="tablewrap"><table class="direct-review-table"><thead><tr><th>藥品</th><th>${loss?'新累計':reviewed.action==='進貨'?'本次實收':forecast?'本次訂貨數量':'數量'}</th><th>${loss?'原累計':'原庫存'}</th><th>${stockHeading}</th>${priceHead}</tr></thead><tbody>${lines}</tbody></table></div>${weeklyChanges?'<p>尚未儲存；確認後同步各廠商分頁：</p><ul>'+weeklyChanges+'</ul>':''}${priced?priceTotal(preview.lines,order):''}${priceChanges?'<p>確認入帳後同步更新原表價格：</p><ul>'+priceChanges+'</ul>':''}${reviewed.action==='沖銷'?'<p>上述金額為原進貨金額；本筆將沖銷原進貨，可核對的原單價與更新日期會一併還原；缺少原值或已有後續更新的欄位會保留目前內容。</p>'+(reversalChanges?'<ul>'+reversalChanges+'</ul>':''):''}${lossCompletionPreview(reviewed,preview.completion)}${loss?'<p>'+preview.lines.map(l=>escape(l.code)+'：本次差額 '+escape(l.delta)+' 瓶').join('；')+'</p>':''}${editable&&options.receiptRows?receiptAddMarkup:''}${editable?'</form>':''}${reviewed.action==='訂貨'&&options.orderRows?orderAddMarkup:''}`,
   async()=>{if(writing||sequence!==reviewSequence)return;
    if(editable){let next;try{next=readEdited();}catch(e){status(e.message);options.onPreviewError?.(e.message);return;}if(next.lines.some((l,i)=>l.quantity!==reviewed.lines[i].quantity)){options.onDraftChange(next);return directReview(next,ask,onSuccess,status,options);}}
    writing=true;const controls=[...document.querySelectorAll('#content input,#content select,#content button')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);status(order?(reviewed.action==='取消訂貨'?'正在取消訂單…':'正在同步訂單…'):'正在入帳與讀回核對，請勿重複送出…');let screen;try{screen=beginProcessing({action:reviewed.action});
    if(options.beforeCommit){
     const reserve=()=>options.beforeCommit(reviewed);
     // Two tabs sharing the pending record must check and reserve it together.
     if((order||reviewed.action==='進貨')&&globalThis.navigator?.locks)await navigator.locks.request('tcm-cloud-pending-v1',reserve);
     else await reserve();
    }
    let result;
    try{result=await runDirect('commit',reviewed,preview.token);}
    finally{markCatalogWrite();}
    if(loss){
     screen.readback();
     const check=await runDirect('preview',reviewed);
     if(check.lines.some(l=>l.delta!==0))throw Error('入帳後資料又有變動，請重新核對累計，不要另建重送');
     if(reviewed.completionSheets)assertLossCompletion(reviewed,check.completion,true);
     result.completion=check.completion;
     result.lines=check.lines;
    }
    // Invalidate in-flight snapshots so a post-write read cannot reuse older data.
    snapshotRequest=null;
    const completionMessage=order?(reviewed.action==='取消訂貨'?'本筆訂單已取消，交易紀錄已保留。':'訂貨量已同步至廠商工作表，尚未入庫。'):result.message;
    screen.readback();await onSuccess(result);status([completionMessage||'已同步 Google Sheets',result.warning].filter(Boolean).join('；'));window.dispatchEvent(new Event('erp-synced'));
    const posted=result.lines||preview.lines;
    const updates=posted.map(l=>'<tr><td data-label="品項">'+escape(l.sheet)+' '+escape(l.code)+' '+escape(l.name)+'</td><td data-label="本次數量／累計">'+escape(l.quantity??l.total)+'</td><td data-label="目前庫存">'+escape(l.after??l.stockAfter)+'</td>'+(priced?priceCells(l,order):'')+'</tr>').join('');
    screen.close();ask('<h3>同步完成・工作表已讀回核對</h3><p>'+escape(completionMessage||'已完成')+'</p>'+lossCompletionPreview(reviewed,result.completion,true)+'<div class="tablewrap"><table class="direct-review-table"><thead><tr><th>品項</th><th>本次數量／累計</th><th>目前庫存</th>'+priceHead+'</tr></thead><tbody>'+updates+'</tbody></table></div>'+(priced?priceTotal(posted,order):'')+'<p>'+escape(reviewed.action==='進貨'?receiptLabel(result.time):result.id||'')+'</p>'+(reviewed.action==='訂貨'?orderPrintControl(reviewed.id):''),options.onContinue||(()=>{}),options.completionLabel||options.returnLabel||'完成',options.onContinue?options.returnLabel:options.returnLabel?null:undefined);if(reviewed.action==='訂貨'){const autoMail=options.autoMail?.()===true;if(autoMail)document.querySelector('#confirm').close();bindOrderPrint(document.querySelector('#confirm-detail'),{autoMail,onCancelOrder:options.onCancelOrder,mergeIds:options.outputMergeIds??null});}
   }catch(e){screen?.close();status(e.message+'；請重新預覽同一筆資料，輸入仍保留。');ask('<h3>結果尚待核對</h3><p>'+escape(e.message)+'</p><p>'+(order?'尚未確認同步結果，請點「重新確認同步結果」。':'請保留同一筆交易，先查詢同步結果；不要另外建立或重複送出。')+'</p>',()=>{},'返回核對');}finally{screen?.close();writing=false;controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});}},options.reviewLabel??(order?(reviewed.action==='取消訂貨'?'確認取消訂貨並還原':'確認訂貨並同步 Google Sheet'):reviewed.completionSheets?'確認入帳並完成正常品項登錄':'確認入帳'),options.returnLabel,returnFromPreview);
  if(reviewed.action==='訂貨'&&options.orderRows)bindOrderAdd(document.querySelector('#confirm-detail'),options.orderRows,()=>reviewed.lines,async line=>{
   const next={...reviewed,lines:[...reviewed.lines,line]};options.onOrderAdd(line);options.onOrderDraft(next);document.querySelector('#confirm').close();await directReview(next,ask,onSuccess,status,options);
  });
  if(options.onDiscard){
   const discard=document.createElement('button');
   discard.type='button';discard.className='secondary';discard.id='receipt-review-discard';discard.textContent='取消這次訂單';
   document.querySelector('#commit').before(discard);
   discard.onclick=()=>{document.querySelector('#confirm').close();options.onDiscard();};
  }
  if(editable){
   readEdited=receiptEditor(reviewed,preview,options.onDraftChange,options.receiptLinkBasis);
   if(options.receiptRows)bindReceiptAdd(document.querySelector('#confirm-detail'),options.receiptRows(),readEdited,async next=>{
    options.onDraftChange(next);
    document.querySelector('#confirm').close();
    await directReview(next,ask,onSuccess,status,options);
   });
  }
 }catch(e){
  if(sequence!==reviewSequence)return;
  readingScreen?.close();
  status(e.message);
  options.onPreviewError?.(e.message);
 }finally{readingScreen?.close();}
}
export async function directSheet(source,signal){
 // Parallel consumers share one request, without keeping stale stock between refreshes.
 if(!snapshotRequest){const request=runDirect('readAll');snapshotRequest=request;request.finally(()=>{if(snapshotRequest===request)snapshotRequest=null;}).catch(()=>{});}
 const r=await snapshotRequest,values=r.sheets[source.name];
 if(!values)throw Error('來源缺少 '+source.name);
 if(signal?.aborted)throw Error('已取消讀取');
 return csvResponse(values);
}
export async function directLog(log){return csvResponse((await runDirect('readLog',{log})).values);}
function csvResponse(values){return new Response(values.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv'}});}
