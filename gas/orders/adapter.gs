const ORDER_V2_INVENTORY='1jbiHJoDf730G7qLywlS4UA2tHW5lPRc6wExLW-7Pq4Q';
const ORDER_V2_TARGET='1YcO7XRhN4T8wrL6wn-jD45lqif--rYQF4HCuBE-Nju8';
const ORDER_V2_SHEETS=['科達單方','科達複方','天明單方','天明複方','富田單方','富田複方'];
function orderV2ReadOnlyCheck(){const ss=orderV2Spreadsheet_();const result=orderV2Build_('科達單方',{start:'2026-01-19',end:'2026-01-24',ignore:[],targetDays:7,shippingDays:0.5,holidayDays:0,blankAsZero:false});console.log(JSON.stringify({version:2,target: ss.getId(),items:result.rows.length,missingDates:result.missing,write:false}));}
function orderV2Spreadsheet_(){return SpreadsheetApp.openById(ORDER_V2_TARGET);}
function orderV2Options_(form){return {start:form.startDate,end:form.endDate,ignore:String(form.ignoreListString||'').split(/[,，\s]+/).filter(Boolean),targetDays:Number(form.targetDays||7),shippingDays:Number(form.shippingDays===undefined?0.5:form.shippingDays),holidayDays:Number(form.holidayDays||0),blankAsZero:form.blankAsZero===true||form.blankAsZero==='on'};}
function orderV2Build_(sheetName,options){
 if(!ORDER_V2_SHEETS.includes(sheetName))throw Error('工作表未允許');
 const src=SpreadsheetApp.openById(ORDER_V2_INVENTORY).getSheetByName(sheetName);if(!src)throw Error('缺少來源：'+sheetName);
 const range=src.getDataRange(),raw=range.getValues(),grid=range.getDisplayValues(),tz=src.getParent().getSpreadsheetTimeZone();
 for(let c=13;c<raw[0].length;c++)if(raw[0][c] instanceof Date)grid[0][c]=Utilities.formatDate(raw[0][c],tz,'yyyy-MM-dd');
 return OrderV2Engine.calculateOrderRows(grid,{name:sheetName,brand:sheetName.slice(0,2),category:sheetName.slice(2)},options);
}
function orderV2Text_(v){const s=String(v==null?'':v);return /^[=+@-]/.test(s)?"'"+s:s;}
function processForm(form){
 const name=String(form.sheetName||'科達單方'),opts=orderV2Options_(form),result=orderV2Build_(name,opts);
 if(result.missing.length)throw Error('未寫入：來源缺少每日日期 '+result.missing.join('、'));
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const ss=orderV2Spreadsheet_(),title='訂貨V2_'+name,sh=ss.getSheetByName(title)||ss.insertSheet(title),old=sh.getLastRow()>2?sh.getRange(3,1,sh.getLastRow()-2,18).getValues():[],confirmed=new Map();
  for(const r of old)if(r[0]&&r[2]!==''&&r[2]!=null){const key=String(r[0])+'|'+String(r[1]);if(confirmed.has(key))throw Error('舊表確認量有重複編號，請先核對');confirmed.set(key,r[2]);}
  // Refuse to discard any prior manual quantity when a source identity disappears.
  const keys=new Set(result.rows.map(r=>r.code+'|'+r.name));for(const key of confirmed.keys())if(!keys.has(key))throw Error('來源品項有變更，已保留舊表，請核對：'+key);
  const rows=result.rows.map(r=>[orderV2Text_(r.code),orderV2Text_(r.name),confirmed.get(r.code+'|'+r.name)??'',r.suggested??'',r.usage,r.average??'',r.stock??'',orderV2Text_(r.stockDate),orderV2Text_(r.status),orderV2Text_(r.shortage),orderV2Text_(r.warnings.join('；')),opts.start,opts.end,r.days,r.blankDays,new Date(),opts.blankAsZero?'已確認空白為零':'空白保留缺漏',r.id]);
  const header=['編號','藥品名稱','確認訂貨量（保留）','新建議訂貨量','期間耗損已填合計','每日平均耗損','未拆封瓶數','原表更新欄','缺藥標記','缺藥率','待核對事項','期間開始','期間結束','開藥天數','空白天數','同步時間','空白處理','來源識別'];
  const size=Math.max(rows.length+2,sh.getLastRow());if(sh.getMaxRows()<size)sh.insertRowsAfter(sh.getMaxRows(),size-sh.getMaxRows());if(sh.getMaxColumns()<18)sh.insertColumnsAfter(sh.getMaxColumns(),18-sh.getMaxColumns());
  const matrix=[['訂貨V2｜'+name,'期間：'+opts.start+'～'+opts.end,'每日耗損欄限定；排除入貨及週合計',...Array(15).fill('')],header,...rows];while(matrix.length<size)matrix.push(Array(18).fill(''));sh.getRange(1,1,size,18).setValues(matrix);sh.setFrozenRows(2);sh.getRange(2,1,1,18).setBackground('#174c41').setFontColor('#ffffff');sh.getRange(3,3,Math.max(1,rows.length),5).setNumberFormat('0.##');sh.getRange(3,16,Math.max(1,rows.length),1).setNumberFormat('yyyy/MM/dd HH:mm');sh.autoResizeColumns(1,11);SpreadsheetApp.flush();
  return '完成：'+title+'，'+rows.length+'項。原訂貨表與已填確認量保留。待核對 '+result.rows.filter(r=>r.warnings.length).length+' 項。';
 }finally{lock.releaseLock();}
}
function runManualSyncRange(){SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(orderV2FormHtml_()).setWidth(620).setHeight(700),'訂貨V2：耗損匯入');}
function orderV2FormHtml_(){return '<!doctype html><meta charset="utf-8"><style>body{font:15px system-ui;padding:20px;color:#174c41}label{display:block;margin:12px 0}input,select,textarea,button{padding:10px;max-width:95%}textarea{width:95%;height:120px}button{background:#174c41;color:white;border:0;border-radius:6px}pre{white-space:pre-wrap}</style><h2>廠商訂貨V2</h2><p>只寫入「訂貨V2_廠商」分頁，原表 D／L 欄保持不變。</p><form id="f"><label>工作表<select name="sheetName">'+ORDER_V2_SHEETS.map(n=>'<option>'+n+'</option>').join('')+'</select></label><label>開始日期<input name="startDate" type="date" required></label><label>結束日期<input name="endDate" type="date" required></label><label>排除日期<input name="ignoreListString" placeholder="2026-01-01,2026-01-02"></label><label>備貨天數<input name="targetDays" type="number" value="7" min="1" max="90"></label><label>運送加成<input name="shippingDays" type="number" value="0.5" step="0.5" min="0"></label><label>假期加成<input name="holidayDays" type="number" value="0" min="0"></label><label><input name="blankAsZero" type="checkbox">我已核對空白耗損代表零</label><button>同步到V2分頁</button></form><hr><h3>匯入 GitHub 確認訂單</h3><textarea id="payload" placeholder="貼上下載的訂單 JSON"></textarea><button id="import">檢查並匯入訂單紀錄</button><pre id="msg"></pre><script>const msg=document.getElementById("msg");document.getElementById("f").onsubmit=function(e){e.preventDefault();const b=this.querySelector("button");b.disabled=true;msg.textContent="同步中…";google.script.run.withSuccessHandler(s=>{msg.textContent=s;b.disabled=false}).withFailureHandler(e=>{msg.textContent=e.message;b.disabled=false}).processForm(Object.fromEntries(new FormData(this)));};document.getElementById("import").onclick=function(){if(!confirm("確認將此訂單寫入雲端紀錄？不傳送廠商、不入庫。"))return;this.disabled=true;google.script.run.withSuccessHandler(s=>{msg.textContent=s;document.getElementById("import").disabled=false}).withFailureHandler(e=>{msg.textContent=e.message;document.getElementById("import").disabled=false}).orderV2Import(document.getElementById("payload").value);};</script>';}
function orderV2Import(json){
 if(typeof json!=='string'||json.length>1000000)throw Error('訂單大小不符');const o=JSON.parse(json);
 if(o.kind!=='tcm-purchase-order'||o.version!==2||!/^PO-[A-Za-z0-9-]{8,100}$/.test(o.id)||!String(o.actor||'').trim()||!Array.isArray(o.lines)||!o.lines.length||o.lines.length>1000)throw Error('訂單格式錯誤');
 OrderV2Engine.periodDays(o.options.start,o.options.end,o.options.ignore||[]);
 const ids=new Set();for(const r of o.lines){if(!ORDER_V2_SHEETS.includes(r.sheet)||typeof r.code!=='string'||!r.code.trim()||typeof r.name!=='string'||!r.name.trim()||!Number.isInteger(r.quantity)||r.quantity<=0||r.quantity>100000)throw Error('藥品編號、名稱或訂量無效');const key=r.sheet+'|'+r.code;if(ids.has(key))throw Error('同廠商編號重複，請核對後再匯入');ids.add(key);}
 const lock=LockService.getScriptLock();lock.waitLock(30000);try{const ss=orderV2Spreadsheet_(),sh=ss.getSheetByName('訂貨V2_確認紀錄')||ss.insertSheet('訂貨V2_確認紀錄');
 const digest=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,json,Utilities.Charset.UTF_8));
 const old=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,13).getValues():[],prior=old.filter(r=>r[0]===o.id);if(prior.length){if(prior.length!==o.lines.length||prior.some(r=>r[12]!==digest))throw Error('同訂單編號已有不同內容，拒絕覆寫');return '此訂單已匯入，未重複新增：'+o.id;}
 const rows=o.lines.map(r=>[o.id,new Date(),orderV2Text_(o.actor),orderV2Text_(r.brand),orderV2Text_(r.category),orderV2Text_(r.code),orderV2Text_(r.name),r.quantity,o.options.start,o.options.end,'待發送・未入庫',orderV2Text_(r.warnings?.join('；')||''),digest]);
 if(sh.getLastRow()===0)rows.unshift(['訂單編號','匯入時間','經手人','廠商','類別','編號','藥品名稱','訂貨瓶數','期間開始','期間結束','狀態','核對事項','內容校驗']);const start=sh.getLastRow()+1,end=start+rows.length-1;if(sh.getMaxRows()<end)sh.insertRowsAfter(sh.getMaxRows(),end-sh.getMaxRows());sh.getRange(start,1,rows.length,13).setValues(rows);sh.setFrozenRows(1);sh.getRange(1,1,1,13).setBackground('#174c41').setFontColor('#ffffff');sh.autoResizeColumns(1,11);SpreadsheetApp.flush();return '已匯入 '+o.lines.length+' 項，訂單 '+o.id+'。尚未傳送廠商或入庫。';
 }finally{lock.releaseLock();}
}
function orderV2DoGet_(){return HtmlService.createHtmlOutput(orderV2FormHtml_()).setTitle('藥庫訂貨V2');}
function orderV2DoPost_(e){
 const raw=String(e.parameter.payload||'');if(raw.length>1000000)throw Error('訂單太大');
 // JSON enters only an escaped textarea; import still requires an explicit click in Google.
 const safe=raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 return HtmlService.createHtmlOutput(orderV2FormHtml_().replace('placeholder="貼上下載的訂單 JSON"></textarea>','placeholder="貼上下載的訂單 JSON">'+safe+'</textarea>')).setTitle('確認匯入藥庫訂單');
}
