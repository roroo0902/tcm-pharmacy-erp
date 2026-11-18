let active=false;
export const isProcessing=()=>active;
const sendIcon = `<svg class="step-symbol" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
 <path fill="#20354f" d="M5 9h22v16H5z"/>
 <path fill="#ffe7a6" d="M7 11h18v12H7z"/>
 <path fill="#c38f42" d="M7 11h2v2h2v2h2v2h6v-2h2v-2h2v-2h2v2h-2v2h-2v2h-2v2h-6v-2h-2v-2H9v-2H7z"/>
 <path fill="#aa474b" d="M13 16h6v5h-6z"/>
 <path fill="#ffe0a2" d="M15 17h2v2h-2z"/>
 <path fill="#5ab6ca" d="M2 5h2v2h2v2H2zM1 12h2v2H1zM27 4h2v2h2v2h-2v2h-2V8h-2V6h2z"/>
</svg>`;
const writeIcon = `<svg class="step-symbol" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
 <path fill="#20354f" d="M5 7h3V5h18v2h2v19H8v-2H5z"/>
 <path fill="#2d7774" d="M7 9h4v13H7z"/>
 <path fill="#c89145" d="M11 7h13v2h2v14H11z"/>
 <path fill="#fff0bf" d="M12 9h12v13H12z"/>
 <path fill="#987140" d="M14 12h8v2h-8zM14 16h8v2h-8z"/>
 <path fill="#af4948" d="M19 19h4v9h-2v-2h-2z"/>
 <path fill="#5ab6ca" d="M28 3h2v2h2v2h-2v2h-2V7h-2V5h2z"/>
</svg>`;
const verifyIcon = `<svg class="step-symbol" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
 <path fill="#20354f" d="M9 4h10v2h3v3h2v10h-2v2h3v3h3v3h-3v2h-3v-3h-3v-4H9v-2H6v-3H4V9h2V6h3z"/>
 <path fill="#dbac55" d="M9 6h10v2h3v10h-3v2H9v-2H6V9h3zM21 21h2v3h3v3h-3v-3h-2z"/>
 <path fill="#92d4df" d="M10 8h8v2h2v7h-3v1h-7v-2H8v-5h2z"/>
 <path fill="#effbff" d="M11 10h6v2h-4v4h-2z"/>
 <path fill="#b88135" d="M27 5h2v2h2v2h-2v2h-2V9h-2V7h2z"/>
</svg>`;

const css=`
#erp-processing{position:fixed;inset:0;margin:auto;width:min(760px,calc(100vw - 32px));max-width:760px;max-height:calc(100dvh - 32px);overflow:auto;padding:0;border:0;border-radius:0;outline:none;background:transparent;color:#203b55;box-shadow:none;z-index:2147483647}
#erp-processing::backdrop{background:#0a1c32df;backdrop-filter:blur(2px)}
#erp-processing .save-frame{margin:10px;padding:30px 30px 24px;background:#fffbee;border:5px solid #203b55;outline:3px solid #d6b568;box-shadow:0 0 0 7px #203b55,inset 0 0 0 2px #e6d4a4;text-align:center}
#erp-processing .save-banner{display:inline-block;margin:-14px auto 14px;padding:8px 32px;background:#203b55;border:2px solid #d6b568;box-shadow:3px 3px 0 #102339;color:#f4d996;font-size:22px;font-weight:700;letter-spacing:4px}
#erp-processing .save-party{height:150px;display:flex;align-items:end;justify-content:center;gap:15px;margin:4px 0 18px}
#erp-processing .save-quill{width:160px;height:144px;object-fit:contain;image-rendering:crisp-edges;image-rendering:pixelated}
#erp-processing h2{font-size:clamp(23px,3.2vw,34px);color:#172c48;letter-spacing:1px;margin:0 0 12px;border:0;padding:0;font-family:Georgia,"PMingLiU",serif}#erp-processing h2::before{display:none}
#erp-processing p{font-size:15px;line-height:1.8;margin:10px 0;color:#40576c}
#erp-processing .save-warning{margin:22px 0;padding:14px 16px;background:#fff0bb;border:2px solid #b28c42;box-shadow:3px 3px 0 #d8c58e;color:#5b3713;font-size:18px;font-weight:700;line-height:1.6}
#erp-processing .save-steps[hidden]{display:none}
#erp-processing .save-steps{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;list-style:none;padding:0;margin:24px 0 18px}
#erp-processing .save-steps li{padding:12px 5px;border:2px solid #c5c4b5;background:#f0eee3;color:#68747c;font-size:14px;font-weight:700}
#erp-processing .step-symbol{display:block;width:32px;height:32px;margin:0 auto 6px}#erp-processing .done{background:#e8f0df!important;border-color:#7b9c70!important;color:#35623c!important}
#erp-processing[data-stage=commit] .step-write,#erp-processing[data-stage=readback] .step-read{background:#ffe9a0;border-color:#ba8b32;color:#654315;box-shadow:3px 3px 0 #d6bb72}
#erp-processing .save-dots{display:flex;gap:7px;justify-content:center;margin:16px auto}#erp-processing .save-dots i{width:8px;height:8px;background:#b78a37;animation:save-pulse 1s steps(2,end) infinite}#erp-processing .save-dots i:nth-child(2){animation-delay:.2s}#erp-processing .save-dots i:nth-child(3){animation-delay:.4s}
#erp-processing .save-footer{font-size:14px;margin-bottom:0}#erp-processing .save-detail{font-size:13px;overflow-wrap:anywhere}
#erp-processing[data-guild=true] .save-party{height:clamp(150px,27dvh,250px);margin:0 0 12px}#erp-processing[data-guild=true] .save-quill{width:100%;height:100%;object-fit:contain;image-rendering:auto}#erp-processing[data-guild=true] h2{font-size:clamp(20px,3vw,29px)}#erp-processing[data-guild=true] .save-frame{padding:22px 20px 18px}#erp-processing[data-guild=true] .save-warning{margin:12px 0;padding:10px}#erp-processing[data-guild=true] .save-banner{font-size:18px;letter-spacing:2px}
#erp-processing[data-guild=true] .save-frame{background:linear-gradient(135deg,#fffbee,#f8edd5);border-color:#172c48;box-shadow:0 0 0 7px #172c48,inset 0 0 0 2px #e4ba58}
#erp-processing[data-guild=true] .save-quill{image-rendering:pixelated}
#erp-processing[data-guild=true] .save-dots i{width:12px;height:12px;border:1px solid #a87520;background:#e1ae3c;box-shadow:inset 1px 1px #ffe4a1}
#erp-processing[data-compact=true]{width:min(520px,calc(100vw - 32px));overflow:visible}
#erp-processing[data-compact=true]::backdrop{background:#132b464d;backdrop-filter:none}
#erp-processing[data-compact=true] .save-frame{--paper-edge:polygon(0 8px,6px 8px,6px 3px,13px 3px,13px 0,24% 0,24% 2px,29% 2px,29% 0,73% 0,73% 2px,78% 2px,78% 0,calc(100% - 12px) 0,calc(100% - 12px) 3px,calc(100% - 5px) 3px,calc(100% - 5px) 8px,100% 8px,100% 44%,calc(100% - 2px) 44%,calc(100% - 2px) 50%,100% 50%,100% calc(100% - 9px),calc(100% - 5px) calc(100% - 9px),calc(100% - 5px) calc(100% - 3px),calc(100% - 13px) calc(100% - 3px),calc(100% - 13px) 100%,74% 100%,74% calc(100% - 2px),69% calc(100% - 2px),69% 100%,28% 100%,28% calc(100% - 2px),22% calc(100% - 2px),22% 100%,12px 100%,12px calc(100% - 3px),5px calc(100% - 3px),5px calc(100% - 9px),0 calc(100% - 9px),0 60%,2px 60%,2px 54%,0 54%);position:relative;isolation:isolate;margin:6px;padding:26px 24px;background:none;border:0;outline:0;box-shadow:none;filter:drop-shadow(3px 4px 2px #49301e44)}
#erp-processing[data-compact=true] .save-frame::before{content:"";position:absolute;inset:0;z-index:-2;pointer-events:none;background:#49301e;clip-path:var(--paper-edge)}
#erp-processing[data-compact=true] .save-frame::after{content:"";position:absolute;inset:5px;z-index:-1;pointer-events:none;transform:none;width:auto;height:auto;border:0;clip-path:var(--paper-edge);background:radial-gradient(ellipse at 0 0,#98633188,transparent 30%),radial-gradient(ellipse at 100% 100%,#98633166,transparent 30%),repeating-linear-gradient(117deg,#84592509 0 1px,transparent 1px 5px),repeating-linear-gradient(27deg,#fff9d922 0 1px,transparent 1px 7px),#f5e4bb;box-shadow:inset 0 0 0 3px #bd955b,inset 0 0 15px 5px #b37b3f77}
#erp-processing[data-compact=true] .save-banner,#erp-processing[data-compact=true] .save-party{display:none}
#erp-processing[data-compact=true] h2{font-size:20px;line-height:1.5;color:#49301e;overflow-wrap:anywhere}
#erp-processing[data-compact=true] p{font-size:13px;margin:8px 0;color:#68472b}
#erp-processing[data-compact=true] .save-warning{font-size:14px;padding:0;margin:10px 0;border:0;box-shadow:none;background:none;color:#68472b}
#erp-processing .save-companion{display:none}
#erp-processing[data-compact=true] .save-frame{display:grid;grid-template-columns:96px minmax(0,1fr);column-gap:18px;text-align:left;align-items:center}
#erp-processing[data-compact=true] .save-frame > *{grid-column:2;min-width:0}
#erp-processing[data-compact=true] .save-frame > .save-companion{display:block;grid-column:1;grid-row:1 / span 6;width:96px;height:100px;object-fit:contain;align-self:center}
#erp-processing[data-compact=true] h2{display:flex;align-items:center;gap:10px;margin:0 0 8px}
#erp-processing[data-compact=true] h2::before{content:"";display:block;position:static;flex:none;width:28px;height:38px;background:url('./web/assets/potion-red.svg') center/contain no-repeat}
#erp-processing[data-compact=true] .save-dots{margin:12px 0 6px;justify-content:flex-start}
#erp-processing[data-notice=true] [hidden]{display:none!important}
#erp-processing[data-receipt-warning=true]{overflow:auto}
#erp-processing[data-receipt-warning=true] .save-frame{display:block;text-align:center}
#erp-processing[data-receipt-warning=true] .save-frame > .save-companion{display:none}
#erp-processing[data-receipt-warning=true] h2{display:block;margin:0 0 14px;overflow-wrap:anywhere}
#erp-processing[data-receipt-warning=true] h2::before{display:block;width:48px;height:48px;margin:0 auto 10px;background:url('./web/assets/catalog-magnifier.svg') center/contain no-repeat}
#erp-processing[data-receipt-warning=true] .save-frame > p{font-weight:700;overflow-wrap:anywhere}
#erp-processing[data-receipt-warning=true] .save-warning{overflow-wrap:anywhere}
#erp-processing[data-receipt-warning=true] button{background:#203b55;color:#fff4d7;border:1px solid #d6b568}
@media(max-width:420px){#erp-processing[data-compact=true] .save-frame{grid-template-columns:64px minmax(0,1fr);gap:0 12px;padding:24px 18px}#erp-processing[data-compact=true] .save-frame > .save-companion{width:64px;height:76px}#erp-processing[data-compact=true] h2{font-size:20px;gap:6px}#erp-processing[data-compact=true] h2::before{width:24px;height:32px}}
@keyframes save-bob{50%{transform:translateY(-5px)}}@keyframes save-pulse{50%{opacity:.25}}
@media(max-width:600px){#erp-processing .save-frame{padding:22px 16px 20px}#erp-processing .save-banner{font-size:19px;padding:7px 20px}#erp-processing .save-warning{font-size:16px;padding:12px 10px;margin:18px 0}#erp-processing .save-steps[hidden]{display:none}
#erp-processing .save-steps{gap:6px;margin:18px 0}#erp-processing .save-steps li{font-size:12px}#erp-processing .save-party{height:144px;margin-bottom:12px}#erp-processing .save-quill{width:160px;height:144px}#erp-processing p{font-size:14px}}
@media(prefers-reduced-motion:reduce){#erp-processing *{animation:none!important}}
`;
export function showReceiptReviewWarning(message,onReview){
 return beginProcessing({reading:true,compact:true,notice:true,catalogMessage:message,receiptWarning:true,onReview});
}
export function beginProcessing({reading=false,catalogMessage='',receiptGuild=false,receiptCompact=false,compact=false,readOnly=false,notice=false,receiptWarning=false,onReview}={}){
 if(active)throw Error('上一筆仍在入帳，請稍候');
 // Non-DOM callers can exercise the transaction logic independently.
 if(!globalThis.document?.createElement)return {readback(){},close(){}};
 const doc=document,win=window,previous=doc.activeElement;
 if(!doc.getElementById('erp-processing-style')){const style=doc.createElement('style');style.id='erp-processing-style';style.textContent=css;doc.head.append(style);}
 const dialog=doc.createElement('dialog');dialog.id='erp-processing';dialog.dataset.stage='commit';dialog.setAttribute('aria-labelledby','save-heading');dialog.setAttribute('aria-describedby','save-warning');dialog.setAttribute('aria-busy','true');
 dialog.innerHTML=`<section class="save-frame"><img class="save-companion" src="./web/assets/slime-king.svg" width="96" height="100" alt="" aria-hidden="true"><div class="save-banner">藥庫存檔中</div><div class="save-party" aria-hidden="true"><img class="save-quill" src="./web/assets/${receiptGuild?'herbal-trade.png':catalogMessage?'catalog-magnifier.svg':'magic-quill.svg'}" width="160" height="144" alt=""></div><h2 id="save-heading">正在入帳與讀回核對…</h2><p>系統正在儲存資料，並確認試算表中的數量。</p><div class="save-warning" id="save-warning">◆ 請勿關閉頁面、重新整理或重複送出</div><ol class="save-steps"><li class="done">${sendIcon}送出資料</li><li class="step-write">${writeIcon}寫入試算表</li><li class="step-read">${verifyIcon}讀回核對</li></ol><div class="save-dots" aria-hidden="true"><i></i><i></i><i></i></div><p class="save-detail" role="status" aria-live="polite">正在等待 Google 完成寫入與核對</p><p class="save-footer">核對完成後，將自動顯示結果</p></section>`;
 if(reading){dialog.dataset.stage='reading';dialog.querySelector('.save-banner').textContent='雲端資料核對中';dialog.querySelector('#save-heading').textContent='正在讀取最新雲端資料…';dialog.querySelector('.save-frame > p').textContent='請稍候，完成後會自動顯示下一步。';dialog.querySelector('.save-steps').hidden=true;dialog.querySelector('.save-detail').textContent='正在取得最新資料，尚未入帳';}
 if(catalogMessage){
  dialog.querySelector('.save-banner').textContent=receiptGuild?'補給資料讀取中':'每日耗損資料讀取中';
  if(receiptGuild)dialog.dataset.guild='true';
  if(receiptCompact||compact)dialog.dataset.compact='true';
  dialog.querySelector('#save-heading').textContent=catalogMessage;
  dialog.querySelector('.save-frame > p').textContent='讀取完成後，視窗會自動關閉。';
  dialog.querySelector('#save-warning').textContent='已填數量會保留';
  dialog.querySelector('.save-detail').textContent=(receiptGuild||receiptCompact)?'正在同步最新庫存與單價':'正在讀取雲端資料';
  dialog.querySelector('.save-footer').hidden=true;
  if(compact||receiptCompact){
   dialog.querySelector('#save-heading').textContent='讀取中…';
   dialog.querySelector('.save-frame > p').textContent=catalogMessage;
   dialog.querySelector('#save-warning').textContent=readOnly?'僅讀取資料，不會變更庫存。':'已填數量會保留，不會扣除庫存。';
   dialog.querySelector('.save-detail').textContent='讀取完成後，視窗會自動關閉。';
  }
 }
 if(notice){
  dialog.dataset.notice='true';
  if(receiptWarning)dialog.dataset.receiptWarning='true';
  dialog.setAttribute('aria-busy','false');
  dialog.querySelector('#save-heading').textContent=receiptWarning?'進貨資料待核對':'上一筆尚未核對';
  dialog.querySelector('#save-warning').textContent=receiptWarning?'已填的進貨數量會保留。返回核對後可重新預覽。':'本次輸入仍保留，尚未送出新的進貨。';
  for(const selector of ['.save-dots','.save-detail','.save-footer','.save-steps'])dialog.querySelector(selector).hidden=true;
 }
 const scrollStyle=doc.body.style,oldOverflow=scrollStyle?.overflow;if(scrollStyle)scrollStyle.overflow='hidden';
 const beforeUnload=e=>{e.preventDefault();e.returnValue='';};dialog.addEventListener('cancel',e=>e.preventDefault());doc.body.append(dialog);
 try{dialog.showModal();}catch(e){dialog.remove();if(scrollStyle)scrollStyle.overflow=oldOverflow;throw e;}
 active=true;if(!catalogMessage)win.addEventListener('beforeunload',beforeUnload);
 const timer=notice?null:setTimeout(()=>{dialog.querySelector('.save-detail').textContent=catalogMessage?'Google 回應較慢，請稍候。':reading?'Google 讀取較慢，請稍候；目前尚未入帳。':'Google 回應較慢，仍在等待結果。請保持頁面開啟，勿重複送出。';},30000);
 let closed=false;const handle={readback(){dialog.dataset.stage='readback';dialog.querySelector('.step-write').classList.add('done');dialog.querySelector('.save-detail').textContent='正在讀回工作表並更新畫面';},close(){if(closed)return;closed=true;clearTimeout(timer);active=false;win.removeEventListener('beforeunload',beforeUnload);dialog.close();dialog.remove();if(scrollStyle)scrollStyle.overflow=oldOverflow;if(previous?.isConnected)previous.focus();}};
 if(notice){
  const button=doc.createElement('button');button.type='button';button.textContent=receiptWarning?'返回核對':'查看待核對操作';button.style.cssText='white-space:normal;max-width:100%;margin-top:12px';
  button.onclick=()=>{handle.close();onReview?.();};dialog.querySelector('.save-frame').append(button);button.focus();
 }
 return handle;
}
