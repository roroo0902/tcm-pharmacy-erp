import {sortSheetRows} from './sheets-sort.mjs';
import {priceCents} from './receipt-pricing.mjs';
export const receiptKey=r=>JSON.stringify([r.name,r.code,r.drug]);
export const receiptPrice=(r,prices)=>prices.has(receiptKey(r))?prices.get(receiptKey(r)):r.unitPriceCents===undefined?'':(r.unitPriceCents/100).toFixed(2);
export function receiptLines(rows,quantities,prices=new Map()){
 const lines=[];
 for(const [key,value] of quantities){
  if(value==='')continue;
  const matches=rows.filter(r=>receiptKey(r)===key),quantity=Number(value);
  if(matches.length!==1)throw Error('已填品項資料已變更，請重新核對或清除數量');
  const r=matches[0];
  if(!r.code||r.warning?.includes('編號'))throw Error(r.drug+'：請先核對編號');
  if(!Number.isInteger(quantity)||quantity<1||quantity>1000000)throw Error(r.drug+'：進貨數量須為正整數');
  if(!Number.isInteger(r.bottles)||r.bottles<0)throw Error(r.drug+'：目前庫存待核對');
  if(r.priceWarning&&!prices.has(key))throw Error(r.drug+'：'+r.priceWarning+'，請手動核對單價');
  let unitPriceCents;try{unitPriceCents=priceCents(receiptPrice(r,prices));}catch(e){throw Error(r.drug+'：'+e.message);}
  lines.push({sheet:r.name,code:r.code,name:r.drug,quantity,...(unitPriceCents===undefined?{}:{unitPriceCents})});
 }
 return lines;
}
export function sortReceiptRows(rows,quantities,key,direction){
 if(key!=='quantity')return sortSheetRows(rows,key,direction);
 return sortSheetRows(rows.map(r=>({...r,stock:r.bottles,bottles:quantities.has(receiptKey(r))&&quantities.get(receiptKey(r))!==''?Number(quantities.get(receiptKey(r))):null})),'bottles',direction).map(({stock,...r})=>({...r,bottles:stock}));
}
