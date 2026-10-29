export const CLOUD_SHEETS=['科達單方','科達複方','天明單方','天明複方','富田單方','富田複方'];
export function cloudDraft(input) {
 const d=typeof input==='string'?JSON.parse(input):input;
 if(!d||d.kind!=='tcm-cloud'||![1,2].includes(d.version)||!['建檔','進貨','訂貨','沖銷','取消訂貨'].includes(d.action))throw Error('不支援的雲端交易');
 if(d.version===2&&(!['進貨','沖銷'].includes(d.action)||d.currency!=='TWD'))throw Error('單價交易須為新台幣進貨或沖銷');
 if(typeof d.id!=='string'||!/^ERP-[a-zA-Z0-9-]{8,80}$/.test(d.id))throw Error('交易編號無效');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||isNaN(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date)throw Error('日期無效');
 if(typeof d.actor!=='string'||!d.actor.trim()||d.actor.length>80)throw Error('經手人必填，最多80字');
 if(typeof d.note!=='string'||d.note.length>500)throw Error('備註最多500字');
 if(!Array.isArray(d.lines)||!d.lines.length||d.lines.length>100)throw Error('每批1至100項');
 const seen=new Set();
 const lines=d.lines.map(l=>{
  if(!CLOUD_SHEETS.includes(l.sheet)||typeof l.code!=='string'||!l.code.trim()||l.code.length>60||typeof l.name!=='string'||!l.name.trim()||l.name.length>120)throw Error('藥品編號、名稱或分頁無效');
  if(!Number.isInteger(l.quantity)||l.quantity<0||l.quantity>1000000||(['進貨','訂貨'].includes(d.action)&&!l.quantity))throw Error('瓶數須為整數；進貨、訂貨須大於0');
  const key=l.sheet+'|'+l.code.trim();if(seen.has(key))throw Error('同批品項重複');seen.add(key);
  const price=Object.hasOwn(l,'unitPriceCents');
  if(price&&(d.version!==2||!Number.isSafeInteger(l.unitPriceCents)||l.unitPriceCents<0||l.unitPriceCents>100000000))throw Error('單價須為0至1,000,000元，最多兩位小數');
  return {sheet:l.sheet,code:l.code.trim(),name:l.name.trim(),quantity:l.quantity,...(price?{unitPriceCents:l.unitPriceCents}:{})};
 });
 if(['沖銷','取消訂貨'].includes(d.action)&&(!/^ERP-[a-zA-Z0-9-]{8,80}$/.test(d.reverses||'')||!d.note.trim()))throw Error('沖銷須提供原交易與原因');
 const total=lines.reduce((n,l)=>n+(l.unitPriceCents??0)*l.quantity,0);if(!Number.isSafeInteger(total))throw Error('金額超出可精確計算範圍');
 return {kind:d.kind,version:d.version,...(d.version===2?{currency:'TWD'}:{}),id:d.id,action:d.action,date:d.date,actor:d.actor.trim(),note:d.note.trim(),lines,...(['沖銷','取消訂貨'].includes(d.action)?{reverses:d.reverses}:{})};
}
export function cloudPlan(d,rows,events=[]) {
 const old=events.find(e=>e.draft.id===d.id);
 if(old){if(JSON.stringify(old.draft)!==JSON.stringify(d))throw Error('同交易編號內容不同，停止寫入');return {duplicate:true,lines:old.lines};}
 let original;
 if(['沖銷','取消訂貨'].includes(d.action)){
  original=events.find(e=>e.draft.id===d.reverses);
  if(!original||original.draft.action!==(d.action==='沖銷'?'進貨':'訂貨'))throw Error('找不到可更正的原交易');
  if(events.some(e=>e.draft.reverses===d.reverses))throw Error('原交易已更正');
  if(JSON.stringify(d.lines)!==JSON.stringify(original.draft.lines))throw Error('沖銷品項須與原交易相同');
 }
 if(d.action==='取消訂貨')return {duplicate:false,lines:original.lines};
 const lines=d.lines.map(l=>{
  const matches=rows.filter(r=>r.sheet===l.sheet&&r.code===l.code);
  if(d.action==='建檔'){
   if(matches.length||rows.some(r=>r.sheet===l.sheet&&r.name===l.name))throw Error(l.code+' 編號或藥名已存在');
   return {...l,before:0,after:l.quantity};
  }
  if(matches.length!==1||matches[0].name!==l.name)throw Error(l.code+' 編號或藥名不符，請重新同步');
  const r=matches[0];if(!Number.isInteger(r.stock)||r.stock<0||r.formula)throw Error(l.code+' 庫存未填、含公式或非整數，請先核對');
  const delta=d.action==='進貨'?l.quantity:d.action==='沖銷'?-l.quantity:0;
  const priceUpdate=d.action==='進貨'&&l.unitPriceCents!==undefined;
  if(priceUpdate&&r.priceFormula)throw Error(l.code+' E欄含公式，請先核對價格設定，尚未入帳');
  const after=r.stock+delta;if(after<0||after>1000000)throw Error('入帳後庫存超出範圍');
  return {...l,...(Object.hasOwn(l,'unitPriceCents')?{amountCents:l.unitPriceCents*l.quantity}:{}),...(priceUpdate?{priceBefore:r.price??'',priceAfter:l.unitPriceCents/100}:{}),row:r.row,sheetId:r.sheetId,before:r.stock,after};
 });
 return {duplicate:false,lines};
}
