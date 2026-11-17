// Called under erpCommit's ScriptLock. Each workbook is atomic; retries only fill gaps.
function erpRegistrationSheets_(draft,dryRun){
 if(draft.action!=='建檔')return [];
 const orderId=ERP.orders,printId='1oAF12BHo29MwFSEmprRXITwXAJqPH2tbINCm0dgjib8',outputs=[];
 const specs=[{id:orderId,kind:'order'},{id:printId,kind:'print'}];
 const plans=specs.map(spec=>{
  const ss=SpreadsheetApp.openById(spec.id),used=new Set(ss.getSheets().map(s=>s.getSheetId())),requests=[],checks=[];
  const nextId=()=>{let n=100;while(used.has(n))n++;used.add(n);return n;};
  const groups=new Map();for(const line of draft.lines){const brand=erpNewSupplierName_(line.sheet).brand,title=spec.kind==='order'?line.sheet:brand+'訂單列印版';if(!groups.has(title))groups.set(title,[]);groups.get(title).push(line);}
  for(const [title,lines] of groups){
   const sh=ss.getSheetByName(title),id=sh?sh.getSheetId():nextId(),quoted="'"+title.replace(/'/g,"''")+"'";
   if(spec.kind==='print'){
    if(!sh){
     const values=[[erpNewSupplierName_(lines[0].sheet).brand+'訂單列印版（尚無確認訂單）','','',''],['單方・藥品名稱','訂量（瓶）','複方・藥品名稱','訂量（瓶）']];
     requests.push({addSheet:{properties:{sheetId:id,title,gridProperties:{rowCount:30,columnCount:4,frozenRowCount:2}}}});
     values.forEach((r,ri)=>r.forEach((v,ci)=>requests.push(loss3Cell_(id,ri,ci,v))));
     checks.push({range:quoted+'!A1:D2',values});
    }
   }else{
    const values=sh?(Sheets.Spreadsheets.Values.get(spec.id,quoted+'!A1:D'+Math.max(2,sh.getLastRow()),{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]):[['屯藥','編號','藥品名稱',''],['','','','本周訂貨量']];
    if(values[0]?.[1]!=='編號'||values[0]?.[2]!=='藥品名稱'||String(values[1]?.[3]||'').replace(/\s/g,'')!=='本周訂貨量')throw Error(title+' 訂貨欄位格式不符，請先核對');
    const codes=new Map();for(let r=2;r<values.length;r++){const code=String(values[r]?.[1]||'').trim();if(!code)continue;if(codes.has(code))throw Error(title+' 訂貨編號重複');codes.set(code,r);}
    let max=sh?sh.getMaxRows():Math.max(100,values.length+lines.length);
    if(!sh){requests.push({addSheet:{properties:{sheetId:id,title,gridProperties:{rowCount:max,columnCount:5,frozenRowCount:2}}}});values.forEach((r,ri)=>r.forEach((v,ci)=>requests.push(loss3Cell_(id,ri,ci,v))));}
    for(const line of lines){
     let row=codes.get(line.code);
     if(row!==undefined){if(String(values[row][2]||'').trim()!==line.name)throw Error(title+' '+line.code+' 訂貨藥名不符');}
     else{row=values.length;values.push(['',line.code,line.name,'']);codes.set(line.code,row);if(row>=max){requests.push({appendDimension:{sheetId:id,dimension:'ROWS',length:row-max+1}});max=row+1;}requests.push(loss3Cell_(id,row,1,line.code),loss3Cell_(id,row,2,line.name));}
     checks.push({range:quoted+'!B'+(row+1)+':C'+(row+1),values:[[line.code,line.name]]});
    }
   }
   if(!sh){requests.push({repeatCell:{range:{sheetId:id,startRowIndex:0,endRowIndex:2,startColumnIndex:0,endColumnIndex:4},cell:{userEnteredFormat:{textFormat:{bold:true},backgroundColor:{red:.95,green:.95,blue:.95},wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}},{updateDimensionProperties:{range:{sheetId:id,dimension:'COLUMNS',startIndex:0,endIndex:4},properties:{pixelSize:160},fields:'pixelSize'}});}
   outputs.push({title,url:'https://docs.google.com/spreadsheets/d/'+spec.id+'/edit#gid='+id});
  }
  return {...spec,requests,checks};
 });
 if(dryRun)return outputs;
 for(const p of plans){
  if(p.requests.length)Sheets.Spreadsheets.batchUpdate({requests:p.requests},p.id);
  for(const check of p.checks){const got=Sheets.Spreadsheets.Values.get(p.id,check.range,{valueRenderOption:'UNFORMATTED_VALUE'}).values||[];for(let r=0;r<check.values.length;r++)for(let c=0;c<check.values[r].length;c++)if((got[r]?.[c]??'')!==check.values[r][c])throw Error('對應分頁讀回不符：'+check.range);}
 }
 return outputs;
}
function erpFinishRegistration_(draft){
 try{return erpRegistrationSheets_(draft,false);}catch(e){throw Error('庫存建檔已完成，但對應分頁尚未完成：'+e.message+'。請沿用同一交易重新確認，只會補建，不會重複入庫。');}
}
