// Weekly confirmed quantities. Included in Cloud.gs; all writes share its atomic batch.
function erpWeeklyPeriod_(date){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
function erpWeeklyTransition_(draft,line,current,events,sheetId){
 const key=line.sheet+'|'+line.code;
 const history=events.flatMap(e=>(e.weekly||[]).filter(w=>w.key===key&&w.sheetId===sheetId));
 const last=history[history.length-1];
 if(current!==''&&(!Number.isInteger(current)||current<0||current>1000000))throw Error(line.code+' 本周訂貨量不是空白或有效整數');
 if(draft.action==='訂貨'){
  const period=erpWeeklyPeriod_(draft.date),same=last&&last.period===period&&last.after===current;
  const baseline=same?last.baseline:current,active=same?last.active.slice():[];
  active.push({id:draft.id,quantity:line.quantity});
  return {key,sheet:line.sheet,code:line.code,name:line.name,sheetId,period,before:current,after:line.quantity,baseline,active};
 }
 const original=events.find(e=>e.draft.id===draft.reverses);
 const originalSync=original&&(original.weekly||[]).find(w=>w.key===key);
 if(!originalSync)return null; // Pre-migration orders never wrote D: do not subtract them.
 if(!last||!last.active.some(a=>a.id===draft.reverses))return null; // Superseded by a new period/manual baseline.
 if(last.after!==current)throw Error(line.code+' 本周訂貨量已被手動修改，取消未寫入；請先核對目前值');
 const active=last.active.filter(a=>a.id!==draft.reverses);
 return {...last,before:current,after:active.length?active[active.length-1].quantity:last.baseline,active};
}
function erpWeeklyRead_(draft,ss,tabs,events,plan){
 const requests=[],changes=[];
 if(plan.duplicate||!['訂貨','取消訂貨'].includes(draft.action))return {requests,changes};
 const loaded={};
 for(const line of draft.lines){
  if(draft.action==='取消訂貨'&&!events.some(e=>e.draft.id===draft.reverses&&(e.weekly||[]).some(w=>w.key===line.sheet+'|'+line.code)))continue;
  let t=loaded[line.sheet];
  if(!t){
   const sh=ss.getSheetByName(line.sheet);
   if(!sh&&draft.action==='取消訂貨')throw Error('原訂貨分頁不存在，取消未寫入');
   if(sh){
    const n=Math.max(2,sh.getLastRow()),range=sh.getRange(1,1,n,4),v=range.getValues(),f=range.getFormulas();
    if(v[0][1]!=='編號'||v[0][2]!=='藥品名稱'||String(v[1][3]).replace(/\s/g,'')!=='本周訂貨量')throw Error(line.sheet+' 訂貨表頭已變動');
    t={id:sh.getSheetId(),v,f,max:sh.getMaxRows(),next:n};
   }else{
    const index=CloudTransaction.CLOUD_SHEETS.indexOf(line.sheet),id=918410100+index;
    if(ss.getSheets().some(x=>x.getSheetId()===id))throw Error('新訂貨分頁編號衝突');
    const catalog=tabs[line.sheet].v.slice(2).filter(r=>String(r[1]||'').trim()&&String(r[3]||'').trim());
    const seen=new Set();for(const r of catalog){const c=String(r[1]).trim();if(seen.has(c))throw Error(line.sheet+' 庫存編號重複，不能建立訂貨名冊');seen.add(c);}
    const v=[['屯藥','編號','藥品名稱',draft.date],['','','','本周\n訂貨量'],...catalog.map(r=>['',String(r[1]).trim(),String(r[3]).trim(),''])];
    const max=Math.max(100,v.length+20);
    requests.push({addSheet:{properties:{sheetId:id,title:line.sheet,gridProperties:{rowCount:max,columnCount:5,frozenRowCount:2}}}});
    requests.push({updateCells:{start:{sheetId:id,rowIndex:0,columnIndex:0},rows:v.map(r=>({values:r.map(x=>x===''?{}:{userEnteredValue:{stringValue:x}})})),fields:'userEnteredValue'}});
    requests.push({repeatCell:{range:{sheetId:id,startRowIndex:0,endRowIndex:2,startColumnIndex:0,endColumnIndex:5},cell:{userEnteredFormat:{backgroundColor:{red:0.13,green:0.24,blue:0.34},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}},wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}});
    requests.push({updateDimensionProperties:{range:{sheetId:id,dimension:'COLUMNS',startIndex:1,endIndex:2},properties:{pixelSize:110},fields:'pixelSize'}},{updateDimensionProperties:{range:{sheetId:id,dimension:'COLUMNS',startIndex:2,endIndex:3},properties:{pixelSize:210},fields:'pixelSize'}},{updateDimensionProperties:{range:{sheetId:id,dimension:'COLUMNS',startIndex:3,endIndex:5},properties:{pixelSize:140},fields:'pixelSize'}},{updateDimensionProperties:{range:{sheetId:id,dimension:'ROWS',startIndex:0,endIndex:2},properties:{pixelSize:42},fields:'pixelSize'}});
    t={id,v,f:[],max,next:v.length};
   }
   loaded[line.sheet]=t;
  }
  const matches=[];for(let i=2;i<t.v.length;i++)if(String(t.v[i][1]||'').trim()===line.code)matches.push(i);
  if(matches.length>1)throw Error(line.code+' 訂貨分頁有重複編號');
  let row=matches[0];
  if(row===undefined){
   if(draft.action==='取消訂貨')throw Error(line.code+' 原訂貨品項不存在');
   row=t.next++;if(row>=t.max){requests.push({appendDimension:{sheetId:t.id,dimension:'ROWS',length:row-t.max+1}});t.max=row+1;}
   t.v[row]=['',line.code,line.name,''];requests.push(loss3Cell_(t.id,row,1,line.code),loss3Cell_(t.id,row,2,line.name));
  }
  if(String(t.v[row][2]).trim()!==line.name)throw Error(line.code+' 訂貨表藥名不符');
  if(t.f[row]&&t.f[row][3])throw Error(line.code+' 本周訂貨量含公式，停止覆寫');
  const change=erpWeeklyTransition_(draft,line,t.v[row][3]??'',events,t.id);
  if(!change)continue;
  change.row=row;changes.push(change);
  const update=loss3Cell_(t.id,row,3,change.after);if(change.after==='')update.updateCells.rows[0].values[0]={};
  requests.push(update);
  const planned=plan.lines.find(x=>x.sheet===line.sheet&&x.code===line.code);planned.orderBefore=change.before;planned.orderAfter=change.after;
 }
 return {requests,changes};
}
function erpWeeklyVerify_(ss,changes){
 for(const w of changes){const sh=ss.getSheetByName(w.sheet);if(!sh||sh.getSheetId()!==w.sheetId)throw Error('訂貨分頁讀回不符');const v=sh.getRange(w.row+1,2,1,3).getValues()[0];if(String(v[0]).trim()!==w.code||String(v[1]).trim()!==w.name||v[2]!==w.after)throw Error(w.code+' 本周訂貨量寫後讀回不符；請沿用交易編號核對');}
}
