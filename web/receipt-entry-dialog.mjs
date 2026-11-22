// Entry reminder only: opening this dialog never submits a transaction.
export function receiptEntryDialog(d,{esc,onCheck,onCancel}){
 const dialog=document.createElement('dialog');
 dialog.setAttribute('aria-labelledby','receipt-entry-title');
 dialog.style.cssText='max-width:540px;width:calc(100% - 32px);box-sizing:border-box;background:#fff8e5;color:#19314c;border:5px double #b68b39;border-radius:18px;padding:28px;box-shadow:0 16px 60px #0007';
 dialog.innerHTML=`<h2 id="receipt-entry-title">👑 上一筆進貨尚待核對</h2><p>請先核對上一筆入帳結果，避免重複登錄。</p><p>進貨日期：${esc(String(d.date||'').replaceAll('-','/'))}<br>經手人：${esc(d.actor||'')}<br>進貨內容：${d.lines?.length||0} 項・${(d.lines||[]).reduce((n,l)=>n+Number(l.quantity||0),0)} 瓶</p><p>目前狀態：待確認入帳結果</p><div style="display:grid;gap:12px"><button data-choice="check">核對上一筆進貨</button><button data-choice="later" class="secondary">稍後處理</button><button data-choice="cancel" class="secondary" style="color:#892b29;border-color:#892b29">取消該筆進貨</button></div><p class="muted">取消前會再次確認並核對入帳狀態。已入帳須改走沖銷，不會直接刪除紀錄。</p>`;
 const close=()=>{dialog.close();dialog.remove();};
 dialog.querySelector('[data-choice="check"]').onclick=()=>{close();onCheck();};
 dialog.querySelector('[data-choice="later"]').onclick=close;
 dialog.querySelector('[data-choice="cancel"]').onclick=()=>{close();onCancel();};
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 document.body.append(dialog);dialog.showModal();return close;
}
