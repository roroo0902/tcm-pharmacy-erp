import {orderKey} from './order-grid-data.mjs';
export function lossOrderEntries(rows,brand,category){
 const counts=new Map();for(const r of rows){const k=orderKey(r);counts.set(k,(counts.get(k)||0)+1);}
 return rows.filter(r=>r.brand===brand&&r.category===category&&r.code&&!r.warning?.includes('編號')&&counts.get(orderKey(r))===1&&Number.isSafeInteger(r.periodLoss)&&r.periodLoss>0&&r.periodLoss<=1000000&&!r.periodInfo?.error).map(r=>[orderKey(r),String(r.periodLoss)]);
}
