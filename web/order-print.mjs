const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const orderPrintControl=id=>`<div data-order-print="${esc(id)}"><button type="button" class="secondary">產生本次訂藥列印版</button><p role="status" style="white-space:normal;overflow-wrap:anywhere">只使用本次已確認訂單；更新前備份舊列印版，不會重送訂貨。</p></div>`;
export function bindOrderPrint(root){
 if(!root)return;root.querySelectorAll('[data-order-print]').forEach(box=>{const button=box.querySelector('button'),status=box.querySelector('[role=status]');button.onclick=async()=>{
  if(button.disabled)return;button.disabled=true;status.textContent='正在讀取已確認訂單、備份並產生列印版…';
  try{
   if(!globalThis.google?.script?.run)throw Error('請由 Google 正式入口產生列印版');
   const result=await new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(Error(e.message||'列印結果待核對'))).erpPrintConfirmedOrder(box.dataset.orderPrint));
   status.innerHTML=esc(result.message)+` 共 ${result.count} 項。`+result.sheets.map(s=>`<br><a href="${esc(s.url)}" target="_blank" rel="noopener">開啟 ${esc(s.title)}（${s.count} 項）↗</a>${s.backup?'<br>舊版已備份：'+esc(s.backup):s.unchanged?'（與既有列印版一致）':''}`).join('');
   button.textContent='重新核對／產生列印版';
  }catch(e){status.textContent=e.message+'；請以此按鈕重試列印，不要重新送出訂貨。';}finally{button.disabled=false;}
 };});
}
