import {isOperationalOrderQa} from '../src/orders.mjs?v=release20261120r1';
import {shortageProgress} from '../src/shortage.mjs?v=release20261120r1';
import {authorize,runDirect} from './direct-sync.mjs?v=release20261120r1';
import {loadSupplierCatalog} from './supplier-catalog.mjs?v=googlesync20261114';

export function orderShortageOptions(state,rows){
 const tracked=new Map();
 for(const record of state.records){
  if(record.status==='closed'||record.status==='cancelled')continue;
  const key=record.sheet+'|'+record.code;
  tracked.set(key,tracked.has(key)?null:record);
 }
 const allocations=state.events.map(event=>event.allocation).filter(Boolean);
 const options=[];
 for(const row of rows){
  if(!row.code||row.warning?.includes('編號')||isOperationalOrderQa(row.name,row.code))continue;
  const key=row.name+'|'+row.code;
  if(!tracked.has(key)){
   if(row.bottles===0)options.push({...row,shortageStatus:'未拆封 0 瓶・待確認開封中存量'});
   continue;
  }
  const record=tracked.get(key);
  if(!record||record.name!==row.drug||!['pending','confirmed'].includes(record.status))continue;
  const labels=[record.status==='confirmed'?'已確認缺藥':'待確認缺藥'];
  if(row.bottles!==null&&row.bottles<record.threshold)labels.push('低庫存待補');
  const progress=shortageProgress(record,allocations,state.orders,state.receipts);
  if(progress.outstanding>0)labels.push('已訂待到貨 '+progress.outstanding+' 瓶');
  if(record.supply==='unavailable')labels.push('廠商缺貨');
  options.push({...row,shortageStatus:labels.join('・')});
 }
 return options;
}

export async function loadOrderShortageOptions(){
 await authorize();
 const [state,catalog]=await Promise.all([runDirect('readShortage'),loadSupplierCatalog()]);
 return orderShortageOptions(state,catalog.rows);
}
