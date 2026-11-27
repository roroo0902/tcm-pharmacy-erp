import {orderEntryUrl} from './google-entry.mjs';
import {openMailProgress,openMailLoading} from './mail-progress.mjs';
import {createMailSendGate} from './mail-send-gate.mjs';
const mailSendGate=createMailSendGate();
import {chooseOrderOutput} from './order-output-choice.mjs';
import {openOrderPdfEditor} from './order-pdf-editor.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const orderPrintControl=(id,leadingButtons='')=>`<div data-order-print="${esc(id)}" style="min-width:0;overflow-wrap:anywhere"><div style="display:flex;gap:8px;flex-wrap:wrap">${leadingButtons}<button type="button" class="secondary" data-print>產生訂藥列印版</button><button type="button" class="secondary" data-pdf>編輯／下載訂藥 PDF</button><button type="button" class="secondary" data-mail>選擇員工寄送 PDF</button></div><p role="status" style="white-space:normal;overflow-wrap:anywhere">可單獨輸出本筆或合併先前已確認訂單；不會重送訂貨或異動庫存。</p><div data-pdf-files></div><div data-mail-panel></div></div>`;
export function googleOrderEntryMarkup(id,output,mergeIds){
 const label={mail:'選擇收件員工並寄送訂貨單',pdf:'編輯與下載本筆訂貨單',print:'產生本筆訂貨單列印版'}[output]||'查看交易紀錄';
 return '<a class="button" href="'+esc(orderEntryUrl(id,output,mergeIds))+'" target="_blank" rel="noopener noreferrer">前往 Google '+label+'</a>';
}
export const orderRpc=(method,arg)=>new Promise((resolve,reject)=>{if(!globalThis.google?.script?.run)return reject(Error('請由 Google 正式入口使用此功能'));google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e.message||'作業未完成，請核對結果')))[method](arg);});
export function bindOrderPrint(root,{autoMail=false,onCancelOrder,mergeIds:chosenMergeIds=null}={}){
 if(!root)return;root.querySelectorAll('[data-order-print]').forEach(box=>{
 const button=box.querySelector('[data-print]'),id=box.dataset.orderPrint;let status=box.querySelector('[role=status]'),panel=box.querySelector('[data-mail-panel]'),filesPanel=box.querySelector('[data-pdf-files]'),delivery=null,urls=[];
 const openDelivery=()=>{if(!delivery){delivery=document.createElement('dialog');delivery.style.cssText='width:calc(100% - 32px);max-width:680px;white-space:normal;overflow-wrap:anywhere';delivery.innerHTML='<h2>訂藥 PDF</h2><p role="status"></p><div data-pdf-files></div><div data-mail-panel></div><div class="actions"><button type="button" class="secondary" data-close-delivery>關閉</button></div>';document.body.append(delivery);delivery.querySelector('[data-close-delivery]').onclick=()=>delivery.close();}status=delivery.querySelector('[role=status]');panel=delivery.querySelector('[data-mail-panel]');filesPanel=delivery.querySelector('[data-pdf-files]');if(!delivery.open)delivery.showModal();};
 const mail=box.querySelector('[data-mail]');let mailVisit=0;
 const mailDraft=async(draft)=>{
  if(mail.disabled)return;
  const visit=++mailVisit,keys=[...new Set([id,...(Array.isArray(draft?.mergeIds)?draft.mergeIds:[])])];
  mail.disabled=true;openDelivery();
  const draftStatus=status,draftPanel=panel,visible=()=>delivery.open&&mailVisit===visit;
  const blockedText=()=>mailSendGate.blocked(keys)==='pending'?'這筆訂單仍在寄送中；返回不會取消，請勿重寄。':'上次寄送結果待確認，請先查收信件。本頁不會重寄。';
  draftPanel.innerHTML='';
  if(mailSendGate.blocked(keys)){draftStatus.textContent=blockedText();mail.disabled=false;return;}
  draftStatus.textContent='正在讀取員工名冊…';
  const loading=openMailLoading('staff');
  try{
   const response=await loading.wait(orderRpc('erpOrderPdfStaff'));
   if(response.left){if(visible())draftStatus.textContent='已返回；尚未寄送郵件。可關閉後重新開啟寄送。';return;}
   loading.close();if(!visible())return;
   const r=response.value;
   draftPanel.innerHTML=`<label>收件員工<select data-recipient style="width:100%;max-width:100%;font-size:16px"><option value="">請選擇員工</option>${r.staff.map(s=>`<option value="${s.row}" ${s.valid?'':'disabled'}>${esc(s.name)}${s.valid?'':'（C 欄 email 缺少或無效）'}</option>`).join('')}</select></label><p data-email></p><button type="button" class="secondary" data-preview disabled>下一步：確認寄送內容 →</button><p>下一步可核對收件人與 PDF 附件，確認後才會寄出。</p><div data-confirm></div>`;
   draftStatus.textContent='請選擇收件人，email 取自員工名冊 C 欄。';
   const select=draftPanel.querySelector('[data-recipient]'),preview=draftPanel.querySelector('[data-preview]'),confirm=draftPanel.querySelector('[data-confirm]');let busy=false;
   select.onchange=()=>{confirm.innerHTML='';const staff=r.staff.find(s=>s.row===Number(select.value));draftPanel.querySelector('[data-email]').textContent=staff?'收件 email：'+staff.email:'';preview.disabled=busy||!staff?.valid;};
   preview.onclick=async()=>{
    if(preview.disabled||!visible())return;
    if(mailSendGate.blocked(keys)){confirm.textContent=blockedText();return;}
    const expected=mailSendGate.snapshot(keys);
    busy=true;preview.disabled=true;select.disabled=true;confirm.textContent='正在核對訂單與附件…';
    try{
     const s=await orderRpc('erpOrderPdfMailPreview',{id,draft,row:Number(select.value),test:false});
     if(!visible())return;
     confirm.innerHTML=`<p>收件人：${esc(s.name)}<br>email：${esc(s.email)}<br>主旨：${esc(s.subject)}</p><p>附件：${s.files.map(f=>esc(f.name)+`（${f.count} 項）`).join('<br>')}</p>`;
     if(s.state==='sent'){confirm.innerHTML+='<p>這份訂單已寄給此員工，系統不會重複寄送。</p>';}
     else if(s.state!=='ready'||['uncertain','sending'].includes(s.previousState)){confirm.innerHTML+='<p>上次寄送結果待確認，請先查收信件；目前不可重寄。</p>';}
     else if(mailSendGate.blocked(keys)){confirm.append(document.createTextNode(blockedText()));}
     else if(!s.mailEnabled){confirm.innerHTML+='<p>PDF 與收件人已核對；管理員尚未完成 Google 寄信授權，目前不能寄出。</p>';}
     else{
      if(s.previousState==='sent')confirm.insertAdjacentHTML('beforeend','<p>這份 PDF 曾寄給此員工，可以再寄一次。</p>');
      const send=document.createElement('button');send.type='button';send.textContent=s.previousState==='sent'?'確認再次寄出訂藥 PDF':'確認寄出訂藥 PDF';confirm.append(send);
      send.onclick=async()=>{
       if(send.disabled||!visible()||!send.isConnected)return;
       const mark=mailSendGate.begin(keys,expected);
       if(!mark){send.disabled=true;confirm.append(document.createTextNode(mailSendGate.blocked(keys)?blockedText():'寄送狀態已變更，請重新核對，不要使用舊預覽。'));return;}
       send.disabled=true;select.disabled=true;preview.disabled=true;mail.disabled=true;
       draftStatus.textContent='正在寄送 PDF；返回不會取消，請勿重複操作。';
       let progress,started=false;
       try{
        progress=openMailProgress({name:s.name,files:s.files,onLeave:()=>{if(visible())delivery.close();if(mailVisit===visit)mail.disabled=false;}});
        started=true;
        const result=await orderRpc('erpOrderPdfMailSend',s.token);
        if(result.state!=='sent')throw Error(result.message||'寄送狀態尚未確認');
        mailSendGate.settle(mark,'sent');
        if(visible()&&!progress.departed()){draftStatus.textContent=result.message;send.textContent='已交付 Google 寄送';progress.success();}
       }catch(e){
        mailSendGate.settle(mark,started?'uncertain':'not-started');
        if(visible()&&!progress?.departed()){
         draftStatus.textContent=started?'寄送結果未確認。請先查收信件，不要重寄或重新送出訂貨。':'尚未開始寄送，請重新核對內容。';
         send.textContent='請重新核對寄送狀態';progress?.failure(draftStatus.textContent);
        }
       }finally{
        if(visible()&&!progress?.departed()){select.disabled=false;preview.disabled=false;}
        if(mailVisit===visit)mail.disabled=false;
       }
      };
     }
    }catch(e){if(visible())confirm.textContent=e.message;}
    finally{busy=false;if(visible()){preview.disabled=!select.value;select.disabled=false;}}
   };
  }catch(e){if(visible())draftStatus.textContent=e.message;loading.failure(e);}
  finally{if(mailVisit===visit)mail.disabled=false;}
 };
 const edit=async(output='pdf',continueMail=false,previousSelection=[])=>{if(!globalThis.google?.script?.run){openDelivery();status.textContent='訂單 '+id+'。請用藥庫的 Google 帳號開啟本筆已確認訂單，核對品項與瓶數。選擇寄送時，最後會請你確認收件人及附件。';panel.innerHTML=googleOrderEntryMarkup(id,continueMail?'mail':output,chosenMergeIds);return;}const mergeIds=chosenMergeIds??await chooseOrderOutput(id,orderRpc,previousSelection);if(mergeIds)openOrderPdfEditor({id,mergeIds,rpc:orderRpc,onMail:mailDraft,sendGate:mailSendGate,onBack:chosenMergeIds===null?()=>edit(output,continueMail,mergeIds):undefined,onCancelOrder,output,autoMail:continueMail});};button.onclick=()=>edit('print');box.querySelector('[data-pdf]').onclick=()=>edit();mail.onclick=()=>edit('pdf',true);if(autoMail)edit('pdf',true);
 });
}


export function resumeOrderOutput({id,output,mergeIds}){
 const root=document.createElement('div');
 root.innerHTML=orderPrintControl(id);
 bindOrderPrint(root,{mergeIds});
 root.querySelector('[data-'+output+']').click();
}
export function openExistingOrderMail(id,onCancelOrder){const root=document.createElement("div");root.innerHTML=orderPrintControl(id);bindOrderPrint(root,{autoMail:true,mergeIds:[],onCancelOrder});}
