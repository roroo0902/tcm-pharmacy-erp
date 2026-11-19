// Read only: identify standard supplier sheets; optional registry pins IDs across renames.
function erpOrderSources_(ss=SpreadsheetApp.openById(ERP.inventory),readHeaders=true){
 const config=ss.getSheetByName('廠商設定'),tabs=ss.getSheets();let candidates;
 if(config){
  const v=config.getDataRange().getValues();if(v.length>1000||v[0].slice(0,5).join('|')!=='啟用|廠商|類別|工作表ID|顯示順序')throw Error('廠商設定欄位應為：啟用、廠商、類別、工作表ID、顯示順序');
  candidates=v.slice(1).filter(r=>r[0]===true||['是','啟用'].includes(String(r[0]).trim())).map(r=>{const sh=tabs.find(s=>s.getSheetId()===Number(r[3]));if(!sh)throw Error('廠商設定的工作表ID不存在');return {sh,brand:String(r[1]).trim(),category:String(r[2]).trim(),order:Number(r[4])||0};}).sort((a,b)=>a.order-b.order);
 }else candidates=tabs.flatMap(sh=>{const m=sh.getName().match(/^(.+?)(單方|複方)$/);return m&&!/備份|測試|副本|封存/.test(m[1])?[{sh,brand:m[1],category:m[2]}]:[];});
 const seen=new Set();return candidates.map(({sh,brand,category})=>{const name=sh.getName();if(!brand||!['單方','複方'].includes(category)||!/^.+(?:單方|複方)$/.test(name))throw Error('廠商名稱或分類無效');if(readHeaders)erpSupplierHeaders_(name,sh.getRange(1,1,2,7).getDisplayValues());const key=brand+'|'+category;if(seen.has(key))throw Error('廠商與類別設定重複');seen.add(key);return {name,brand,category,gid:sh.getSheetId()};});
}
function erpSupplierHeaders_(name,rows){
 if(rows[0]?.[1]!=='編號'||rows[0]?.[3]!=='藥品名稱'||rows[0]?.[4]!=='價格'||rows[1]?.[6]!=='未拆封')throw Error(name+' 欄位格式不符，請依標準庫存表建立');
}
function erpSupplierInventoryCatalog_(){
 const ss=SpreadsheetApp.openById(ERP.inventory),sources=erpOrderSources_(ss,false),sheets={};
 if(!sources.length)return {sources,sheets};
 const ranges=sources.flatMap(({name})=>{
  const title="'"+name.replace(/'/g,"''")+"'";
  return ['B:B','D:G','K:L'].map(range=>title+'!'+range);
 });
 const result=Sheets.Spreadsheets.Values.batchGet(ERP.inventory,{ranges,valueRenderOption:'FORMATTED_VALUE'});
 if(result.valueRanges?.length!==ranges.length)throw Error('庫存品項來源未完整讀取');
 sources.forEach(({name},index)=>{
  const [codes,details,shortages]=result.valueRanges.slice(index*3,index*3+3).map(range=>range.values||[]);
  // Rebuild original column positions and row numbers for the shared catalog parser.
  const rows=Array.from({length:Math.max(codes.length,details.length,shortages.length)},(_,i)=>{
   const [drug='',price='',updated='',stock='']=details[i]||[];
   const [flag='',rate='']=shortages[i]||[];
   return ['',codes[i]?.[0]??'','',drug,price,updated,stock,'','','',flag,rate];
  });
  erpSupplierHeaders_(name,rows);
  sheets[name]=rows;
 });
 return {sources,sheets};
}
function erpOrderCatalog_(){
 const sources=erpOrderSources_(),inv=SpreadsheetApp.openById(ERP.inventory),orders=SpreadsheetApp.openById(ERP.orders),sheets={},weekly={};
 for(const source of sources){sheets[source.name]=erpDirectValues_(inv.getSheetByName(source.name));const sh=orders.getSheetByName(source.name),map={};if(sh){const v=sh.getRange(1,1,Math.max(2,sh.getLastRow()),4).getValues();if(v[0][1]!=='編號'||v[0][2]!=='藥品名稱'||String(v[1][3]).replace(/\s/g,'')!=='本周訂貨量')throw Error(source.name+' 訂貨欄位格式不符');for(const r of v.slice(2)){const code=String(r[1]||'').trim();if(!code)continue;if(Object.prototype.hasOwnProperty.call(map,code))throw Error(source.name+' 訂貨編號重複');if(r[3]!==''&&(!Number.isInteger(r[3])||r[3]<0))throw Error(code+' 本周訂量格式不符');map[code]=r[3]===''?null:r[3];}}weekly[source.name]=map;}
 return {sources,sheets,weekly};
}
