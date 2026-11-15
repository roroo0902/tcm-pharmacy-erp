import {runDirect} from './direct-sync.mjs?v=compact20261030';
export const lossCompletionMarkup='<div class="loss-completion"><button type="button" class="secondary" id="loss-complete">完成所選日期登錄</button><span id="loss-completion-state" role="status">完成前請確認未填品項代表當日零耗損。</span></div>';
export function mountLossCompletion(root,{context,ask,esc}){
 let disposed=false,ticket=0,busy=false;
 const button=root.querySelector('#loss-complete'),state=root.querySelector('#loss-completion-state');
 function render(r){
  const pending=r.pendingCount||0;
  button.textContent=pending?'完成正常品項登錄':'完成所選日期登錄';
  state.innerHTML=`${esc(r.date)} ${esc(r.sheet)}：${esc(r.error||(r.eligibleComplete||r.complete?(pending?'部分完成':'已完成登錄'):'尚未完成或需重新確認'))}`+
   (pending?`<strong style="display:block;color:#963b24">正常品項 ${r.eligibleCount} 筆${r.eligibleComplete?'已完成':'可先完成'}；仍有 ${pending} 筆待核對，不列為零耗損。</strong><details><summary>查看待核對品項（${pending} 筆）</summary><ul>${r.pendingItems.map(x=>`<li>${esc(x.name)}：${esc(x.reason)}</li>`).join('')}</ul></details>`:'');
  button.disabled=!!r.error||busy;
 }
 async function refresh(){const n=++ticket,ctx=context();if(!ctx.sheet)return;button.disabled=true;try{const r=await runDirect('readLossDay',ctx);if(disposed||n!==ticket)return;render(r);}catch(e){if(!disposed&&n===ticket)state.textContent=e.message;}}
 button.onclick=async()=>{if(busy)return;const ctx=context();try{
  if(ctx.blocked)throw Error(ctx.blocked);if(!ctx.actor)throw Error('請選擇經手人');busy=true;button.disabled=true;
  const r=await runDirect('readLossDay',ctx);if(disposed)return;if(r.error)throw Error(r.error);
  ask(`<p>確認 ${esc(ctx.date)} ${esc(ctx.sheet)} 的 ${r.eligibleCount} 筆正常品項耗損已登錄完成？</p>`+
   (r.pendingCount?`<p><strong>仍有 ${r.pendingCount} 筆待核對，本次僅標記部分完成。待核對品項保留，不當成零耗損。</strong></p>`:'')+
   '<p>僅正常品項的未填耗損視為當日零耗損。此操作只記錄完成狀態，不扣庫存、不修改歷史耗損；後續資料更正需重新確認。</p>',async()=>{
    try{const now=context();if(now.blocked||now.sheet!==ctx.sheet||now.date!==ctx.date)throw Error(now.blocked||'日期或廠商已切換，請重新確認');
     await runDirect('completeLossDay',{...ctx,fingerprint:r.fingerprint,confirmBlankZero:true,confirmPartial:!!r.pendingCount});
     const check=await runDirect('readLossDay',ctx);if(!check.eligibleComplete&&!check.complete)throw Error('完成狀態讀回不一致，請重新確認');
     if(!disposed)render(check);window.dispatchEvent(new Event('erp-synced'));
    }catch(e){if(!disposed)state.textContent=e.message;}
   },r.pendingCount?'確認正常品項完成':'確認完成登錄');
 }catch(e){if(!disposed)state.textContent=e.message;}finally{busy=false;if(!disposed)await refresh();}};

 return {refresh,dispose:()=>{disposed=true;ticket++;}};
}
