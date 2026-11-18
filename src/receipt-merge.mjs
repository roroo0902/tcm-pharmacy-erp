import {cloudDraft} from './cloud-transaction.mjs?v=compact20261030';

export function mergeReceipts(previous,current){
 if(previous.date!==current.date)throw Error('兩筆進貨日期不同，請分開入帳。');
 if(previous.actor!==current.actor)throw Error('兩筆經手人不同，請分開入帳。');
 const lines=new Map();
 for(const line of [...previous.lines,...current.lines]){
  const key=JSON.stringify([line.sheet,line.code]);
  const prior=lines.get(key);
  if(!prior){lines.set(key,{...line});continue;}
  if(prior.name!==line.name||prior.create!==line.create)throw Error(line.code+' 的品項資料不同，請分開入帳。');
  if(prior.unitPriceCents!==line.unitPriceCents)throw Error(line.name+' 的單價不同，請分開入帳。');
  prior.quantity+=line.quantity;
 }

 const shortageLinks=new Map();
 for(const link of [...(previous.shortageLinks||[]),...(current.shortageLinks||[])]){
  const key=JSON.stringify([link.sheet,link.code]);
  const prior=shortageLinks.get(key);
  if(!prior){shortageLinks.set(key,{...link});continue;}
  if(prior.shortageId!==link.shortageId)throw Error(link.code+' 的缺藥關聯不同，請分開入帳。');
  prior.quantity+=link.quantity;
 }
 const note=[...new Set([previous.note,current.note].filter(Boolean))].join('\n');
 const priced=previous.version===2||current.version===2;
 return cloudDraft({...previous,version:priced?2:1,...(priced?{currency:'TWD'}:{}),note,lines:[...lines.values()],shortageLinks:[...shortageLinks.values()]});
}
