function shortageVerifyIsolated(){
 loss3Actor_();const qa=SpreadsheetApp.create('QA_缺藥管理_20261103_'+Date.now()),id=qa.getId();const sh=qa.getSheets()[0];sh.setName('驗收單方');sh.getRange(1,1,4,7).setValues([['','編號','','藥品名稱','價格','',''],['','','','','','','未拆封'],['','QA01','','隔離驗收甲',100,'',0],['','QA02','','隔離驗收乙',200,'',5]]);
 const record={id:'SH-'+Utilities.getUuid(),revision:0,sheet:'驗收單方',code:'QA01',name:'隔離驗收甲',need:4,threshold:2,priority:'normal',status:'confirmed',supply:'unknown',eta:'',note:'隔離驗收',actor:'系統驗收'};
 PropertiesService.getScriptProperties().setProperty('SHORTAGE_QA',JSON.stringify({id,record}));
 const original={inventory:ERP.inventory,orders:ERP.orders};ERP.inventory=id;ERP.orders=id;
 try{const request={operationId:'SE-'+Utilities.getUuid(),kind:'record',value:record};shortageSave_(request);SpreadsheetApp.flush();
 const substitution={id:'SU-'+Utilities.getUuid(),revision:0,from:{sheet:record.sheet,code:record.code,name:record.name},to:{sheet:record.sheet,code:'QA02',name:'隔離驗收乙'},priority:1,status:'pending',note:'僅隔離測試，不作醫療用途',actor:'系統驗收'};shortageSave_({operationId:'SE-'+Utilities.getUuid(),kind:'substitution',value:substitution});
 const order={draft:{id:'ERP-'+Utilities.getUuid(),action:'訂貨',date:'2026-11-03',actor:'系統驗收',lines:[{sheet:record.sheet,code:record.code,name:record.name,quantity:4}]}};
 const receipt={draft:{id:'ERP-'+Utilities.getUuid(),action:'進貨',date:'2026-11-03',actor:'系統驗收',lines:[{sheet:record.sheet,code:record.code,name:record.name,quantity:2}]}};
 for(const [name,e] of [[ERP.orderLog,order],[ERP.log,receipt]])qa.insertSheet(name).getRange(1,1,2,2).setValues([['交易編號','交易JSON'],[e.draft.id,JSON.stringify(e)]]);
 SpreadsheetApp.flush();
 for(const [kind,e,q] of [['order',order,4],['receipt',receipt,2]])shortageSave_({operationId:'SE-'+Utilities.getUuid(),kind:'allocation',actor:'系統驗收',value:{shortageId:record.id,kind,transactionId:e.draft.id,sheet:record.sheet,code:record.code,quantity:q}});
 console.log(JSON.stringify({status:'隔離寫入完成，請執行 shortageVerifyReadback 獨立讀回',id,url:qa.getUrl()}));
 }finally{ERP.inventory=original.inventory;ERP.orders=original.orders;}
}
function shortageVerifyReadback(){loss3Actor_();const qa=JSON.parse(PropertiesService.getScriptProperties().getProperty('SHORTAGE_QA')||'null');if(!qa)throw Error('尚未執行隔離寫入');const original={inventory:ERP.inventory,orders:ERP.orders};ERP.inventory=qa.id;ERP.orders=qa.id;try{const state=shortageRead_(),r=state.records.find(r=>r.id===qa.record.id),p=Shortage.shortageProgress(r,state.events.filter(e=>e.allocation).map(e=>e.allocation),state.orders,state.receipts);if(state.records.length!==1||state.substitutions.length!==1||state.events.length!==4||p.ordered!==4||p.received!==2||p.outstanding!==2)throw Error('隔離讀回結果不符');console.log(JSON.stringify({passed:true,records:state.records.length,substitutions:state.substitutions.length,events:state.events.length,progress:p,spreadsheetId:qa.id}));}finally{ERP.inventory=original.inventory;ERP.orders=original.orders;}}
