let active=false;
export const isProcessing=()=>active;
const css=`
#erp-processing{position:fixed;inset:0;margin:auto;width:min(760px,calc(100vw - 32px));max-width:760px;max-height:calc(100dvh - 32px);overflow:auto;padding:0;border:0;background:transparent;color:#203b55;box-shadow:none;z-index:2147483647}
#erp-processing::backdrop{background:#0a1c32df;backdrop-filter:blur(2px)}
#erp-processing .save-frame{margin:10px;padding:30px 30px 24px;background:#fffbee;border:5px solid #203b55;outline:3px solid #d6b568;box-shadow:0 0 0 7px #203b55,inset 0 0 0 2px #e6d4a4;text-align:center}
#erp-processing .save-banner{display:inline-block;margin:-14px auto 14px;padding:8px 32px;background:#203b55;border:2px solid #d6b568;box-shadow:3px 3px 0 #102339;color:#f4d996;font-size:22px;font-weight:700;letter-spacing:4px}
#erp-processing .save-party{height:116px;display:flex;align-items:end;justify-content:center;gap:15px;margin:4px 0 18px}
#erp-processing .save-slime{width:116px;height:100px;object-fit:contain}#erp-processing .save-potion{width:42px;height:56px;image-rendering:pixelated;animation:save-bob 1.4s steps(3,end) infinite}
#erp-processing h2{font-size:clamp(23px,3.2vw,34px);color:#172c48;letter-spacing:1px;margin:0 0 12px;border:0;padding:0;font-family:Georgia,"PMingLiU",serif}#erp-processing h2::before{display:none}
#erp-processing p{font-size:15px;line-height:1.8;margin:10px 0;color:#40576c}
#erp-processing .save-warning{margin:22px 0;padding:14px 16px;background:#fff0bb;border:2px solid #b28c42;box-shadow:3px 3px 0 #d8c58e;color:#5b3713;font-size:18px;font-weight:700;line-height:1.6}
#erp-processing .save-steps{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;list-style:none;padding:0;margin:24px 0 18px}
#erp-processing .save-steps li{padding:12px 5px;border:2px solid #c5c4b5;background:#f0eee3;color:#68747c;font-size:14px;font-weight:700}
#erp-processing .step-symbol{display:block;font-size:26px;height:38px;color:inherit}#erp-processing .done{background:#e8f0df!important;border-color:#7b9c70!important;color:#35623c!important}
#erp-processing[data-stage=commit] .step-write,#erp-processing[data-stage=readback] .step-read{background:#ffe9a0;border-color:#ba8b32;color:#654315;box-shadow:3px 3px 0 #d6bb72}
#erp-processing .save-dots{display:flex;gap:7px;justify-content:center;margin:16px auto}#erp-processing .save-dots i{width:8px;height:8px;background:#b78a37;animation:save-pulse 1s steps(2,end) infinite}#erp-processing .save-dots i:nth-child(2){animation-delay:.2s}#erp-processing .save-dots i:nth-child(3){animation-delay:.4s}
#erp-processing .save-footer{font-size:14px;margin-bottom:0}#erp-processing .save-detail{font-size:13px;overflow-wrap:anywhere}
@keyframes save-bob{50%{transform:translateY(-5px)}}@keyframes save-pulse{50%{opacity:.25}}
@media(max-width:600px){#erp-processing .save-frame{padding:22px 16px 20px}#erp-processing .save-banner{font-size:19px;padding:7px 20px}#erp-processing .save-warning{font-size:16px;padding:12px 10px;margin:18px 0}#erp-processing .save-steps{gap:6px;margin:18px 0}#erp-processing .save-steps li{font-size:12px}#erp-processing .save-party{height:104px;margin-bottom:12px}#erp-processing p{font-size:14px}}
@media(prefers-reduced-motion:reduce){#erp-processing *{animation:none!important}}
`;
export function beginProcessing(){
 if(active)throw Error('上一筆仍在入帳，請稍候');
 // Non-DOM callers can exercise the transaction logic independently.
 if(!globalThis.document?.createElement)return {readback(){},close(){}};
 const doc=document,win=window,previous=doc.activeElement;
 if(!doc.getElementById('erp-processing-style')){const style=doc.createElement('style');style.id='erp-processing-style';style.textContent=css;doc.head.append(style);}
 const dialog=doc.createElement('dialog');dialog.id='erp-processing';dialog.dataset.stage='commit';dialog.setAttribute('aria-labelledby','save-heading');dialog.setAttribute('aria-describedby','save-warning');dialog.setAttribute('aria-busy','true');
 dialog.innerHTML=`<section class="save-frame"><div class="save-banner">藥庫存檔中</div><div class="save-party" aria-hidden="true"><img class="save-slime" src="./web/assets/slime-king.svg" width="116" height="100" alt=""><img class="save-potion" src="./web/assets/potion-red.svg" width="42" height="56" alt=""></div><h2 id="save-heading">正在入帳與讀回核對…</h2><p>系統正在儲存資料，並確認試算表中的數量。</p><div class="save-warning" id="save-warning">◆ 請勿關閉頁面、重新整理或重複送出</div><ol class="save-steps"><li class="done"><span class="step-symbol">✓</span>送出資料</li><li class="step-write"><span class="step-symbol">▤</span>寫入試算表</li><li class="step-read"><span class="step-symbol">◇</span>讀回核對</li></ol><div class="save-dots" aria-hidden="true"><i></i><i></i><i></i></div><p class="save-detail" role="status" aria-live="polite">正在等待 Google 完成寫入與核對</p><p class="save-footer">核對完成後，將自動顯示結果</p></section>`;
 const beforeUnload=e=>{e.preventDefault();e.returnValue='';};dialog.addEventListener('cancel',e=>e.preventDefault());doc.body.append(dialog);
 try{dialog.showModal();}catch(e){dialog.remove();throw e;}
 active=true;win.addEventListener('beforeunload',beforeUnload);
 const timer=setTimeout(()=>{dialog.querySelector('.save-detail').textContent='Google 回應較慢，仍在等待結果。請保持頁面開啟，勿重複送出。';},30000);
 let closed=false;return {readback(){dialog.dataset.stage='readback';dialog.querySelector('.step-write').classList.add('done');dialog.querySelector('.save-detail').textContent='正在讀回工作表並更新畫面';},close(){if(closed)return;closed=true;clearTimeout(timer);active=false;win.removeEventListener('beforeunload',beforeUnload);dialog.close();dialog.remove();if(previous?.isConnected)previous.focus();}};
}
