import {cloudDraft} from '../src/cloud-transaction.mjs';

export function mergeUnpostedOrders(previous,current){
 const lines=new Map();
 for(const line of [...previous.lines,...current.lines]){
  const key=JSON.stringify([line.sheet,line.code||line.name]);
  const existing=lines.get(key);
  if(!existing){lines.set(key,{...line});continue;}
  if(existing.name!==line.name||existing.manual!==line.manual||existing.unitPriceCents!==line.unitPriceCents){
   throw Error('同品項的名稱、來源或單價不同，請先核對：'+line.sheet+' '+line.name);
  }
  existing.quantity+=line.quantity;
 }
 const links=new Map();
 for(const link of [...(previous.shortageLinks||[]),...(current.shortageLinks||[])]){
  const key=JSON.stringify([link.sheet,link.code]);
  const existing=links.get(key);
  if(!existing){links.set(key,{...link});continue;}
  if(existing.shortageId!==link.shortageId)throw Error('同品項對應不同缺藥紀錄，請先核對：'+link.code);
  existing.quantity+=link.quantity;
 }
 // Keep the old transaction ID so an in-flight submission cannot post both versions.
 return cloudDraft({...current,id:previous.id,note:[previous.note,current.note].filter(Boolean).join('／'),lines:[...lines.values()],shortageLinks:[...links.values()]});
}
