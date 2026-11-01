// Read only: identify standard supplier sheets; optional registry pins IDs across renames.
function erpOrderSources_(){
 const ss=SpreadsheetApp.openById(ERP.inventory),config=ss.getSheetByName('廠商設定');let candidates;
 if(config){
  const v=config.getDataRange().getValues();if(v.length>1000||v[0].slice(0,5).join('|')!=='啟用|廠商|類別|工作表ID|顯示順序')throw Error('廠商設定欄位應為：啟用、廠商、類別、工作表ID、顯示順序');
  candidates=v.slice(1).filter(r=>r[0]===true||['是','啟用'].includes(String(r[0]).trim())).map(r=>{const sh=ss.getSheets().find(s=>s.getSheetId()===Number(r[3]));if(!sh)throw Error('廠商設定的工作表ID不存在');return {sh,brand:String(r[1]).trim(),category:String(r[2]).trim(),order:Number(r[4])||0};}).sort((a,b)=>a.order-b.order);
 }else candidates=ss.getSheets().flatMap(sh=>{const m=sh.getName().match(/^(.+?)(單方|複方)$/);return m&&!/備份|測試|副本|封存/.test(m[1])?[{sh,brand:m[1],category:m[2]}]:[];});
 const seen=new Set();return candidates.map(({sh,brand,category})=>{const name=sh.getName(),v=sh.getRange(1,1,2,7).getDisplayValues();if(!brand||!['單方','複方'].includes(category)||!/^.+(?:單方|複方)$/.test(name))throw Error('廠商名稱或分類無效');if(v[0][1]!=='編號'||v[0][3]!=='藥品名稱'||v[0][4]!=='價格'||v[1][6]!=='未拆封')throw Error(name+' 欄位格式不符，請依標準庫存表建立');const key=brand+'|'+category;if(seen.has(key))throw Error('廠商與類別設定重複');seen.add(key);return {name,brand,category,gid:sh.getSheetId()};});
}
function erpOrderCatalog_(){
 const sources=erpOrderSources_(),inv=SpreadsheetApp.openById(ERP.inventory),orders=SpreadsheetApp.openById(ERP.orders),sheets={},weekly={};
 for(const source of sources){sheets[source.name]=erpDirectValues_(inv.getSheetByName(source.name));const sh=orders.getSheetByName(source.name),map={};if(sh){const v=sh.getRange(1,1,Math.max(2,sh.getLastRow()),4).getValues();if(v[0][1]!=='編號'||v[0][2]!=='藥品名稱'||String(v[1][3]).replace(/\s/g,'')!=='本周訂貨量')throw Error(source.name+' 訂貨欄位格式不符');for(const r of v.slice(2)){const code=String(r[1]||'').trim();if(!code)continue;if(Object.prototype.hasOwnProperty.call(map,code))throw Error(source.name+' 訂貨編號重複');if(r[3]!==''&&(!Number.isInteger(r[3])||r[3]<0))throw Error(code+' 本周訂量格式不符');map[code]=r[3]===''?null:r[3];}}weekly[source.name]=map;}
 return {sources,sheets,weekly};
}
