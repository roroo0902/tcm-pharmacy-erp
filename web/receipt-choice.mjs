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
   .receipt-choice{isolation:isolate;width:min(760px,calc(100% - 32px));max-width:none;max-height:calc(100dvh - 32px);padding:24px 28px;border:3px solid #16283d;border-radius:0;background:radial-gradient(ellipse at center,#fffdf4 50%,#fae8ba);box-shadow:inset 0 0 0 4px #d4a451,inset 0 0 0 6px #f8e4af,0 5px 0 #17283dd9;color:#142940;overflow:auto}
   .receipt-choice::backdrop{background:#13243b9c}
   .receipt-choice .receipt-choice-header{display:flex;gap:12px;align-items:center;justify-content:flex-start;margin:0 0 12px;padding:0;background:none;border:0}
   .receipt-choice .receipt-choice-header img{width:94px;height:86px;object-fit:contain;flex:none;image-rendering:pixelated}
   .receipt-choice h2{margin:0 0 6px;padding:0;border:0;color:inherit;font-size:clamp(21px,4vw,29px);letter-spacing:0}
   .receipt-choice p{margin:0;font-size:14px;line-height:1.5}
   .receipt-choice button.secondary{background:#fff3d7;color:#1a3551;border:1px solid #a78949;box-shadow:0 2px 0 #ad9566}
   .receipt-choice button[data-mode=merge]:enabled{background:#223d5a;color:#fff9e8;border:1px solid #142c46;box-shadow:0 2px 0 #142c46}
   .receipt-choice .receipt-choice-totals{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;text-align:center;padding:12px;border:1px solid #c6ab74;border-radius:4px;background:#fff4d8}
   .receipt-choice .receipt-choice-option{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:10px 0;padding:12px;border:1px solid #cfb887;border-radius:4px;background:#fffefaaf}
   .receipt-choice .receipt-choice-option strong{display:block;margin-bottom:3px}
   .receipt-choice .receipt-choice-option button{min-height:44px;min-width:120px;flex:none}
   .receipt-choice footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:14px 0 0;padding:0;background:none;border:0;color:inherit}
   @media(max-width:520px){.receipt-choice{padding:16px}.receipt-choice .receipt-choice-header img{width:58px;height:58px}.receipt-choice .receipt-choice-option{align-items:stretch;flex-direction:column;gap:6px}.receipt-choice .receipt-choice-option button{width:100%}.receipt-choice footer{align-items:flex-start;flex-direction:column-reverse}}
  </style><header class="receipt-choice-header">
   <img src="./web/assets/receipt-quill-scroll.png" width="94" height="86" alt="">
   <div><h2 id="receipt-choice-title">選擇進貨處理方式</h2><p>上一筆查無入帳紀錄。請選擇要預覽的進貨單。</p></div>
  </header>
  <div class="receipt-choice-totals"><strong>上一筆 ${count(previous)}</strong><strong>本次 ${count(current)}</strong></div>
  <div class="receipt-choice-option"><div><strong>先入帳上一筆進貨單</strong><p>本次填寫內容會保留。</p></div><button class="secondary" type="button" data-mode="previous">預覽上一筆</button></div>
  <div class="receipt-choice-option"><div><strong>只入帳本筆進貨單</strong><p>上一筆會保留待確認。</p></div><button class="secondary" type="button" data-mode="current">預覽本筆</button></div>
  <div class="receipt-choice-option"><div><strong>合併兩筆進貨單</strong><p>${esc(mergeHelp)}</p></div><button type="button" data-mode="merge"${mergeError?' disabled':''}>合併並預覽</button></div>
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
  dialog.querySelector('[data-close]').onclick=close;
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  for(const button of dialog.querySelectorAll('[data-mode]'))button.onclick=()=>done(button.dataset.mode);
  document.body.append(dialog);
  try{dialog.showModal();}catch(e){dialog.remove();throw e;}
  signal.addEventListener('abort',close,{once:true});
 });
}
