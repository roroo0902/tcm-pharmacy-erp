import {cloudDraft} from './cloud-transaction.mjs';
export function confirmedPrintPlan(events,id){
 const matches=events.filter(e=>e?.draft?.id===id);
 if(matches.length!==1)throw Error('找不到唯一的已確認訂單');
 const d=cloudDraft(matches[0].draft);
 if(d.action!=='訂貨')throw Error('僅可列印已確認訂貨');
 if(events.some(e=>e?.draft?.reverses===id))throw Error('訂單已取消，不可產生列印版');
 const groups=new Map();
 for(const l of d.lines){const m=l.sheet.match(/^(.+)(單方|複方)$/);if(!m||m[1].length>60||/[\[\]:*?\/\\]/.test(m[1]))throw Error('廠牌或類別無法辨識');const [_,brand,category]=m;if(!groups.has(brand))groups.set(brand,{單方:[],複方:[]});groups.get(brand)[category].push(l);}
 return [...groups].map(([brand,categories])=>{
  const columns=[];for(const category of ['單方','複方']){const lines=categories[category];for(let i=0;i<lines.length;i+=22){const chunk=lines.slice(i,i+22);columns.push([brand+'訂購清單｜'+d.date+'｜'+d.actor,category+'・藥品名稱',...chunk.map(l=>l.name)],['',d.date.slice(5).replace('-','/')+'\n訂量（瓶）',...chunk.map(l=>l.quantity)]);}}
  const values=Array.from({length:24},(_,r)=>columns.map((c,i)=>r===0&&i>0?'':c[r]??''));
  return {brand,title:brand+'訂單列印版',id:d.id,date:d.date,actor:d.actor,count:categories.單方.length+categories.複方.length,values};
 });
}
