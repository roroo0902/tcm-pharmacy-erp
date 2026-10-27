const codes=new Intl.Collator('zh-TW',{numeric:true,sensitivity:'base'});
function dateKey(value){
 const m=String(value??'').trim().match(/^(?:(\d{4})[/-])?(\d{1,2})[/-](\d{1,2})$/);
 if(!m)return null;
 const year=m[1]?Number(m[1]):2000,month=Number(m[2]),day=Number(m[3]);
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
 return month*100+day;
}
export function sortSheetRows(rows,key='code',direction='asc'){
 const value=r=>key==='code'?(r.code?.trim()||null):key==='bottles'?(Number.isFinite(r.bottles)?r.bottles:null):dateKey(r.updated);
 return [...rows].sort((a,b)=>{
  const x=value(a),y=value(b);
  if(x===null||y===null)return x===y?0:x===null?1:-1;
  const compared=key==='code'?codes.compare(x,y):x-y;
  return direction==='desc'?-compared:compared;
 });
}
