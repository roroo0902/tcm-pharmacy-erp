import {validate} from './store.mjs';

export function lossBatch(data, lines, meta) {
 const next=structuredClone(data), seen=new Set();
 if(!lines.length)throw Error('請至少填寫一項耗損數量');
 for(const {row,qty,opening,id,entryId} of lines){
  if(!row.code?.trim()||!row.drug?.trim())throw Error('品項名稱與編號必填');
  const key=JSON.stringify([row.brand,row.category,row.code]);
  if(seen.has(key))throw Error('同一廠牌類別的編號重複');seen.add(key);
  if(!Number.isFinite(qty)||qty<=0)throw Error('耗損數量必須大於零');
  const matches=next.items.filter(i=>i.brand===row.brand&&i.category===row.category&&(i.code===row.code||i.name===row.drug));
  if(matches.length>1||matches.some(i=>i.name!==row.drug||i.code!==row.code))throw Error(`${row.code} 與本機編號或藥名不一致，請先核對`);
  let item=matches[0];
  if(!item){
   if(opening==null||opening==='')throw Error(`${row.drug}：請先填寫耗損前實際瓶數`);
   item={id,name:row.drug,code:row.code,brand:row.brand,category:row.category,safety:0,openingDate:meta.date,openingBottles:opening};
   next.items.push(item);
  }
  if(next.entries.some(e=>e.id===entryId))throw Error('此批耗損已登錄');
  next.entries.push({id:entryId,itemId:item.id,type:'耗損',bottles:qty,date:meta.date,actor:meta.actor,note:meta.note});
 }
 validate(next);return next;
}
