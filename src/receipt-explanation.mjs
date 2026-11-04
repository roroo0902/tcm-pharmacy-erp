// Transaction-time facts only. Never infer historical balances from today's stock.
export function receiptExplanation(event){
 const d=event.draft||event;
 const lines=(d.lines||[]).map(l=>{
  const matches=(event.lines||[]).filter(x=>x.sheet===l.sheet&&x.code===l.code&&x.name===l.name&&x.quantity===l.quantity);
  const saved=event.draft&&matches.length===1?matches[0]:{};
  const stock=n=>Number.isInteger(n)&&n>=0?n+' 瓶':'未記錄';
  const priced=Number.isSafeInteger(l.unitPriceCents)&&l.unitPriceCents>=0;
  const money=n=>(n/100).toLocaleString('zh-TW',{maximumFractionDigits:2});
  return {...l,beforeText:stock(saved.before),afterText:stock(saved.after),priceText:priced?money(l.unitPriceCents)+' 元／瓶':'單價未提供',amountText:priced?money(l.unitPriceCents*l.quantity)+' 元':'小計未計算'};
 });
 const missing=lines.filter(l=>l.unitPriceCents===undefined).length;
 const quantity=lines.reduce((n,l)=>n+l.quantity,0),total=lines.reduce((n,l)=>n+(l.unitPriceCents||0)*l.quantity,0);
 const totalText=`本次共 ${lines.length} 項，進貨 ${quantity} 瓶，${missing?'已提供單價品項合計':'進貨總額'} ${(total/100).toLocaleString('zh-TW',{maximumFractionDigits:2})} 元${missing?`（${missing} 項未計價）`:''}`;
 const text=lines.map(l=>`【進貨入庫】\n廠商／分類：${l.sheet}\n藥品：${l.name}（${l.code}）\n本次進貨：${l.quantity} 瓶\n入庫前庫存：${l.beforeText} → 入庫後庫存：${l.afterText}\n單價：${l.priceText}\n本項小計：${l.amountText}`).join('\n\n')+'\n\n'+totalText;
 return {lines,totalText,text};
}
