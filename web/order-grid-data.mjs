import {receiptKey,receiptPrice,receiptLines} from './receive-grid-data.mjs';
import {priceCents} from './receipt-pricing.mjs';
import {orderDateKey} from './order-sort.mjs';
export {receiptKey as orderKey,receiptPrice as orderPrice};
export function orderLines(rows,quantities,prices){return receiptLines(rows,quantities,prices);}
const collator=new Intl.Collator('zh-TW',{numeric:true,sensitivity:'base'});
export function sortOrderGrid(rows,quantities,prices,key,direction,year){
 const number=v=>v==null||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
 const value=r=>{const k=receiptKey(r);if(key==='code')return r.code||null;if(key==='drug')return r.drug||null;if(key==='quantity')return number(quantities.get(k));if(key==='updated')return orderDateKey(r.updated,year);if(key==='price'||key==='amount'){let p;try{p=priceCents(receiptPrice(r,prices));}catch{return null;}return p===undefined?null:key==='price'?p:number(quantities.get(k))===null?null:p*Number(quantities.get(k));}return number(r[key]);};
 return [...rows].sort((a,b)=>{const x=value(a),y=value(b);if(x===null||y===null)return x===y?0:x===null?1:-1;return (typeof x==='string'?collator.compare(x,y):x-y)*(direction==='desc'?-1:1);});
}
