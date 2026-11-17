import {orderKey} from './order-grid-data.mjs';
export function lossOrderEntries(rows,brand,category){
 const identity=r=>JSON.stringify([r.name,r.code]);
 const counts=new Map();for(const r of rows){const k=identity(r);counts.set(k,(counts.get(k)||0)+1);}
 return rows.filter(r=>r.brand===brand&&r.category===category&&r.code&&!r.warning?.includes('編號')&&counts.get(identity(r))===1&&Number.isSafeInteger(r.periodLoss)&&r.periodLoss>0&&r.periodLoss<=1000000&&!r.periodInfo?.error).map(r=>[orderKey(r),String(r.periodLoss)]);
}
