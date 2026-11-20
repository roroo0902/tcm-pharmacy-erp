import {runDirect} from './direct-sync.mjs?v=release20261120r1';
export const lossCompletionMarkup='<div class="loss-completion"><span id="loss-completion-state" role="status">正在核對本分類的耗損登錄狀態。</span></div>';
export function mountLossCompletion(root,{context,esc}){
 let disposed=false,ticket=0;
 const state=root.querySelector('#loss-completion-state');
 function render(r){
  const pending=r.pendingCount||0;
  state.innerHTML=`${esc(r.date)} ${esc(r.sheet)}：${esc(r.error||(r.eligibleComplete||r.complete?(pending?'部分完成':'已完成登錄'):'尚未完成或需重新確認'))}`+
   (pending?`<strong style="display:block;color:#963b24">正常品項 ${r.eligibleCount} 筆${r.eligibleComplete?'已完成':'可先完成'}；仍有 ${pending} 筆待核對，不列為零耗損。</strong><details><summary>查看待核對品項（${pending} 筆）</summary><ul>${r.pendingItems.map(x=>`<li>${esc(x.name)}：${esc(x.reason)}</li>`).join('')}</ul></details>`:'');
 }
 async function refresh(){const n=++ticket,ctx=context();if(!ctx.sheet)return;try{const r=await runDirect('readLossDay',ctx);if(disposed||n!==ticket)return;render(r);}catch(e){if(!disposed&&n===ticket)state.textContent=e.message;}}
 return {refresh,show:r=>{ticket++;if(r)render(r);else state.textContent='正在核對本分類的耗損登錄狀態。';},dispose:()=>{disposed=true;ticket++;}};
}
