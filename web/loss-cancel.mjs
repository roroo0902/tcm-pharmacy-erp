// A local cancellation never infers that a cloud write did not occur.
export function lossCancellationSummary(draft,data){
 if(!draft?.lines?.length||data?.date!==draft.date||!Array.isArray(data.loss))throw Error('耗損日期或資料無法核對，請重新查詢');
 return draft.lines.map(line=>{
  const matches=data.loss.filter(r=>r.sheet===line.sheet&&r.code===line.code&&r.name===line.name);
  if(matches.length!==1||matches[0].error||!Number.isInteger(matches[0].posted)||matches[0].posted<0)throw Error(line.name+'：雲端累計無法核對，保留待登錄內容');
  return {...line,posted:matches[0].posted};
 });
}
