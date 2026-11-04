export function periodAdvice(row,period,completion,stock){
 const missing=(completion||[]).filter(d=>!d.complete).map(d=>d.date);
 const days=period?.days;
 if(!row||row.error||!row.complete||!Number.isInteger(days)||days<1||!Number.isFinite(row.total)||row.total<0)return {average:null,suggested:null,missing};
 const average=row.total/days;
 const suggested=Number.isFinite(stock)&&stock>=0?Math.max(0,Math.ceil(average*7.5-stock)):null;
 return {average,suggested,missing};
}
