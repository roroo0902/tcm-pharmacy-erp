const codes=new Intl.Collator('zh-TW',{numeric:true,sensitivity:'base'});
function dateKey(value,referenceYear){
 const m=String(value??'').trim().match(/^(?:(\d{4})[/-])?(\d{1,2})[/-](\d{1,2})$/);
 if(!m)return null;
 const year=m[1]?Number(m[1]):referenceYear??2000,month=Number(m[2]),day=Number(m[3]);
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
 return referenceYear?date.getTime():month*100+day;
}
export function sortSheetRows(rows,key='code',direction='asc',referenceYear){
 const text=v=>String(v??'').trim()||null;
 const value=r=>{switch(key){
 case 'code':return text(r.code);case 'drug':return text(r.drug);
 case 'brand':return text(r.brand)?[r.brand,r.category||'']:null;
 case 'price':return Number.isFinite(r.unitPriceCents)?r.unitPriceCents:null;
 case 'bottles':return Number.isFinite(r.bottles)?r.bottles:null;
 case 'stockout':return text(r.stockout);
 case 'shortage':{const m=String(r.shortage??'').trim().match(/^(\d+(?:\.\d+)?)\s*[%％]$/);return m&&Number(m[1])<=100?Number(m[1]):null;}
 case 'warning':return text(r.warning);default:return dateKey(r.updated,referenceYear);}};
 return [...rows].sort((a,b)=>{
  const x=value(a),y=value(b);
  if(x===null||y===null)return x===y?0:x===null?1:-1;
  const compared=Array.isArray(x)?codes.compare(x[0],y[0])||codes.compare(x[1],y[1]):typeof x==='string'?codes.compare(x,y):x-y;
  return direction==='desc'?-compared:compared;
 });
}
