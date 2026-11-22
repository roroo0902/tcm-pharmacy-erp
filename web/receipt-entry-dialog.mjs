// Entry reminder only: opening this dialog never submits a transaction.
import {writingGoblin,wavingGoblin} from './receipt-goblin-animation.mjs';
const styles=`
.receipt-entry-dialog{max-width:860px;width:calc(100% - 24px);max-height:90dvh;overflow:auto;box-sizing:border-box;background:#fff8e5;color:#19314c;border:6px double #b68b39;border-radius:12px;padding:22px;box-shadow:0 16px 60px #0007;font-size:15px}
.receipt-entry-dialog::backdrop{background:#0c2034a6}
.receipt-entry-dialog *{box-sizing:border-box}
.receipt-entry-dialog .receipt-entry-header{display:block;text-align:center}
.receipt-entry-dialog .receipt-entry-goblin{width:110px;height:134px;object-fit:contain;image-rendering:pixelated;pointer-events:none}
.receipt-entry-dialog h2#receipt-entry-title{margin:0;padding:12px 10px;background:#19314c;color:#fff8e5;border:5px double #b68b39;border-radius:8px;font-size:clamp(19px,3vw,28px);line-height:1.4;text-align:center;text-shadow:none}
.receipt-entry-dialog h2#receipt-entry-title::before,.receipt-entry-dialog h2#receipt-entry-title::after{content:none;display:none}
.receipt-entry-dialog p{color:#19314c;line-height:1.6;margin:12px 0}
.receipt-entry-dialog .receipt-entry-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 24px;border-block:1px solid #b68b39;padding:10px 0}
.receipt-entry-dialog .receipt-entry-summary{background:#f5e8c7;border:1px solid #b68b39;padding:8px 12px;font-weight:700;text-align:center}
.receipt-entry-dialog .receipt-entry-table-wrap{max-height:220px;overflow:auto;border:2px solid #b68b39;border-radius:4px}
.receipt-entry-dialog table{width:100%;margin:0;border-collapse:collapse;font-size:14px;table-layout:fixed}
.receipt-entry-dialog th,.receipt-entry-dialog td{padding:9px 7px;border:1px solid #cbb989;text-align:center;overflow-wrap:anywhere;color:#19314c;background:#fff8e5;white-space:normal}
.receipt-entry-dialog th{position:sticky;top:0;background:#19314c;color:#fff8e5;font-weight:700}
.receipt-entry-dialog .receipt-entry-status{text-align:center;font-weight:700}
.receipt-entry-dialog .receipt-entry-status span{display:inline-block;border:2px solid #b68b39;padding:4px 14px;border-radius:4px}
.receipt-entry-dialog .receipt-entry-bottom{display:grid;grid-template-columns:minmax(80px,1fr) minmax(0,3fr) minmax(80px,1fr);align-items:end;gap:12px}
.receipt-entry-dialog .receipt-entry-actions{display:grid;gap:10px}
.receipt-entry-dialog button[data-choice]{display:block;width:100%;min-height:44px;margin:0;padding:10px;border:3px double #9c772c;border-radius:5px;font:inherit;font-weight:700;cursor:pointer;opacity:1;box-shadow:0 2px 0 #71582a;text-shadow:none;background:#e6bf60;color:#142b46}
.receipt-entry-dialog button[data-choice=later]{background:#19314c;color:#fff}
.receipt-entry-dialog button[data-choice=cancel]{background:#812d3b;color:#fff}
.receipt-entry-dialog button[data-choice]::before,.receipt-entry-dialog button[data-choice]::after{content:none;display:none}
.receipt-entry-dialog button[data-choice]:hover{filter:brightness(1.08)}
.receipt-entry-dialog button[data-choice]:focus-visible{outline:3px solid #14748a;outline-offset:3px}
.receipt-entry-dialog .receipt-entry-note{font-size:13px;color:#263e54;margin-bottom:0;text-align:center}
.receipt-entry-dialog .receipt-entry-bottom img{width:100%;height:170px;object-fit:contain;object-position:center bottom;image-rendering:pixelated;pointer-events:none}
@media(max-width:520px){.receipt-entry-dialog{padding:12px;font-size:14px}.receipt-entry-dialog .receipt-entry-header{grid-template-columns:64px 1fr;gap:8px}.receipt-entry-dialog .receipt-entry-goblin{width:64px;height:85px}.receipt-entry-dialog h2#receipt-entry-title{font-size:18px;padding:8px 5px}.receipt-entry-dialog table{font-size:12px}.receipt-entry-dialog th,.receipt-entry-dialog td{padding:8px 4px}.receipt-entry-dialog .receipt-entry-bottom{grid-template-columns:48px minmax(0,1fr) 48px;gap:4px}.receipt-entry-dialog .receipt-entry-bottom img{height:85px}.receipt-entry-dialog button[data-choice]{font-size:13px;padding:9px 3px}}
`;
export function receiptEntryDialog(d,{esc,onCheck,onCancel}){
 const dialog=document.createElement('dialog');
 dialog.className='receipt-entry-dialog';
 dialog.setAttribute('aria-labelledby','receipt-entry-title');
 const lines=Array.isArray(d.lines)?d.lines:[];
 const total=lines.reduce((n,l)=>n+(Number.isFinite(Number(l.quantity))?Number(l.quantity):0),0);
 const rows=lines.map(l=>`<tr><td>${esc(String(l.name||'未提供藥名'))}</td><td>${esc(String(l.code||'—'))}</td><td>${esc(String(l.sheet||'—'))}</td><td>${esc(String(l.quantity??'—'))} 瓶</td></tr>`).join('');
 dialog.innerHTML=`<style>${styles}</style><div class="receipt-entry-header"><div><h2 id="receipt-entry-title">上一筆進貨尚待核對</h2><p>請先核對上一筆入帳結果，避免重複登錄。</p></div></div><div class="receipt-entry-meta"><span>進貨日期：${esc(String(d.date||'').replaceAll('-','/'))}</span><span>經手人：${esc(String(d.actor||''))}</span></div><p class="receipt-entry-summary">進貨內容：${lines.length} 項・${total} 瓶</p><div class="receipt-entry-table-wrap" role="region" aria-label="上一筆進貨品項明細" tabindex="0"><table><thead><tr><th scope="col">藥品名稱</th><th scope="col">品號</th><th scope="col">廠商／類別</th><th scope="col">實收數量</th></tr></thead><tbody>${rows||'<tr><td colspan="4">這筆紀錄沒有品項明細，請先核對交易紀錄。</td></tr>'}</tbody></table></div><p class="receipt-entry-status"><span>待確認入帳結果</span></p><div class="receipt-entry-bottom"><img src="${writingGoblin}" alt="" aria-hidden="true"><div class="receipt-entry-actions"><button type="button" data-choice="check">核對上一筆進貨</button><button type="button" data-choice="later">稍後處理</button><button type="button" data-choice="cancel">取消該筆進貨</button></div><img src="${wavingGoblin}" alt="" aria-hidden="true"></div><p class="receipt-entry-note">取消前會再次確認並核對入帳狀態。<br>已入帳須改走沖銷，不會直接刪除紀錄。</p>`;
 const close=()=>{dialog.close();dialog.remove();};
 dialog.querySelector('[data-choice="check"]').onclick=()=>{close();onCheck();};
 dialog.querySelector('[data-choice="later"]').onclick=close;
 dialog.querySelector('[data-choice="cancel"]').onclick=()=>{close();onCancel();};
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 document.body.append(dialog);dialog.showModal();return close;
}
