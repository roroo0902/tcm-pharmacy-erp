const count=d=>`${d.lines.length} 項・${d.lines.reduce((sum,line)=>sum+line.quantity,0).toLocaleString('zh-TW')} 瓶`;
const esc=value=>value.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);

export function chooseReceiptMode(previous,current,mergeError,signal){
 if(signal.aborted)return Promise.resolve(null);
 const originalItems=new Set(previous.lines.map(line=>JSON.stringify([line.sheet,line.code])));
 const repeated=current.lines.some(line=>originalItems.has(JSON.stringify([line.sheet,line.code])));
 const mergeHelp=mergeError||(repeated?'有相同藥品，請確認是兩批到貨後再合併。':'在同一張預覽核對合計瓶數。');
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');
  dialog.className='receipt-choice';
  dialog.setAttribute('aria-labelledby','receipt-choice-title');
  dialog.innerHTML=`<style>
   dialog.receipt-choice{
    box-sizing:border-box;width:calc(100% - 40px);max-width:920px;max-height:90dvh;overflow:auto;padding:28px 34px;
    border:3px solid #e7c577;border-radius:14px;color:#fff3d3;background:radial-gradient(ellipse at 50% 0,#162e52,#0c1b34 75%);
    box-shadow:inset 0 0 0 4px #13243e,inset 0 0 0 6px #b98b44,0 0 0 3px #15273b,0 24px 80px #020917bb;
   }
   .receipt-choice::backdrop{background:#13243b9c}
   .receipt-choice .receipt-choice-header{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:16px;margin:0 0 20px;padding:0 0 16px;background:none;border:0;border-bottom:2px solid #cfab60}
   .receipt-choice .receipt-choice-header::after{content:'◇◆◇';position:absolute;bottom:-11px;left:50%;transform:translateX(-50%);padding:0 8px;background:#132746;color:#e4c276;font-size:15px;letter-spacing:3px}
   .receipt-choice .receipt-choice-header img{width:146px;height:129px;object-fit:contain;image-rendering:pixelated}
   .receipt-choice h2,.receipt-choice .receipt-choice-option strong,.receipt-choice .receipt-choice-totals{font-family:Georgia,"PMingLiU","Noto Serif TC",serif}
   .receipt-choice h2{margin:0 0 5px;padding:0;border:0;color:inherit;font-size:clamp(24px,3.4vw,36px);letter-spacing:1px}
   .receipt-choice h2::before{display:none}
   .receipt-choice p{margin:0;color:inherit;font-size:15px;line-height:1.5}
   .receipt-choice button.secondary{background:#102541;color:#fff1cb;border:2px solid #d4b36d;box-shadow:inset 0 0 0 2px #31465e}
   .receipt-choice .receipt-choice-x{align-self:start;width:44px;height:44px;min-height:44px;padding:0;font-size:27px;line-height:1}
   .receipt-choice .receipt-choice-totals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));text-align:center;padding:10px 0;border:1px solid #c9a65c;border-radius:7px;background:#16374b;font-size:20px}
   .receipt-choice .receipt-choice-totals strong{padding:0 6px}
   .receipt-choice .receipt-choice-totals strong+strong{border-left:1px solid #c9a65c}
   .receipt-choice .receipt-choice-option{
    display:grid;grid-template-columns:58px minmax(0,1fr) auto;align-items:center;gap:12px;margin:12px 0;padding:14px;border:2px solid #bb9859;border-radius:12px 4px;
    background:linear-gradient(120deg,#193c52,#102638);box-shadow:inset 0 0 0 2px #0b1d31,inset 0 0 0 3px #677570;
   }
   .receipt-choice .receipt-choice-option:has(button:enabled):hover,.receipt-choice .receipt-choice-option:has(button:focus-visible){
    border-color:#ffe39a;background:linear-gradient(120deg,#235baa,#142f65 75%);box-shadow:inset 0 0 0 2px #98743e,inset 0 0 0 3px #9bbbea,0 0 9px #dbb65b55;
   }
   .receipt-choice .receipt-choice-scroll{width:48px;height:48px;background:url('./web/assets/order-scroll.svg') center/contain no-repeat;image-rendering:pixelated}
   .receipt-choice .receipt-choice-scroll-pair{position:relative;transform:translate(-2px,-4px)}
   .receipt-choice .receipt-choice-scroll-pair::after{content:'';position:absolute;inset:15px -8px -4px 16px;background:inherit}
   .receipt-choice .receipt-choice-copy{min-width:0;border-left:1px solid #b99854;padding-left:14px}
   .receipt-choice .receipt-choice-option strong{display:block;margin-bottom:3px;font-size:clamp(18px,2.4vw,25px);line-height:1.3}
   .receipt-choice .receipt-choice-option button{min-height:44px;min-width:124px;padding:8px 12px;background:linear-gradient(#ffedae,#e4bf6c);color:#142740;border:1px solid #edd48f;box-shadow:0 3px 0 #9b7439}
   .receipt-choice .receipt-choice-option button:disabled{background:#ac9d78;color:#272c34;box-shadow:none}
   .receipt-choice footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:16px 0 0;padding:0;background:none;border:0;color:inherit}
   @media(max-width:560px){
    dialog.receipt-choice{width:calc(100% - 22px);max-height:94dvh;padding:15px}
    .receipt-choice .receipt-choice-header{gap:8px;margin-bottom:15px;padding-bottom:12px}
    .receipt-choice .receipt-choice-header img{width:52px;height:57px}
    .receipt-choice h2{font-size:21px;letter-spacing:0}.receipt-choice p{font-size:13px}
    .receipt-choice .receipt-choice-totals{font-size:15px}
    .receipt-choice .receipt-choice-option{grid-template-columns:36px minmax(0,1fr);padding:10px;gap:6px 8px}
    .receipt-choice .receipt-choice-scroll{width:30px;height:33px}
    .receipt-choice .receipt-choice-scroll-pair::after{inset:10px -6px -4px 10px}
    .receipt-choice .receipt-choice-copy{padding-left:8px}
    .receipt-choice .receipt-choice-option button{grid-column:2;justify-self:start;padding:6px 10px}
    .receipt-choice footer{align-items:flex-start;flex-direction:column-reverse;gap:6px}
   }
  </style><header class="receipt-choice-header">
   <img src="./web/assets/receipt-quill-scroll.png" width="86" height="76" alt="">
   <div><h2 id="receipt-choice-title">選擇進貨處理方式</h2><p>上一筆查無入帳紀錄。請選擇要預覽的進貨單。</p></div>
   <button type="button" class="secondary receipt-choice-x" data-close aria-label="關閉">×</button>
  </header>
  <div class="receipt-choice-totals"><strong>上一筆 ${count(previous)}</strong><strong>本次 ${count(current)}</strong></div>
  <div class="receipt-choice-option"><span class="receipt-choice-scroll" aria-hidden="true"></span><div class="receipt-choice-copy"><strong>先入帳上一筆進貨單</strong><p>本次填寫內容會保留。</p></div><button type="button" data-mode="previous">預覽上一筆</button></div>
  <div class="receipt-choice-option"><span class="receipt-choice-scroll" aria-hidden="true"></span><div class="receipt-choice-copy"><strong>只入帳本筆進貨單</strong><p>上一筆會保留待確認。</p></div><button type="button" data-mode="current">預覽本筆</button></div>
  <div class="receipt-choice-option"><span class="receipt-choice-scroll receipt-choice-scroll-pair" aria-hidden="true"></span><div class="receipt-choice-copy"><strong>合併兩筆進貨單</strong><p>${esc(mergeHelp)}</p></div><button type="button" data-mode="merge"${mergeError?' disabled':''}>合併並預覽</button></div>
  <footer><button type="button" class="secondary" data-close autofocus>返回修改</button><p>確認入帳後才會增加庫存。</p></footer>`;
  let settled=false;
  const done=value=>{
   if(settled)return;
   settled=true;
   signal.removeEventListener('abort',close);
   dialog.close();
   dialog.remove();
   resolve(value);
  };
  const close=()=>done(null);
  for(const button of dialog.querySelectorAll('[data-close]'))button.onclick=close;
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  for(const button of dialog.querySelectorAll('[data-mode]'))button.onclick=()=>done(button.dataset.mode);
  document.body.append(dialog);
  try{dialog.showModal();}catch(e){dialog.remove();throw e;}
  signal.addEventListener('abort',close,{once:true});
 });
}
