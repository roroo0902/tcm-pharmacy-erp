import {createXlsx} from './xlsx-export.mjs';
import {orderKey,orderPrice,sortOrderGrid} from './order-grid-data.mjs';
import {priceCents} from './receipt-pricing.mjs';
export function selectOrderExport(rows,quantities,prices,f){return sortOrderGrid(rows.filter(r=>r.brand===f.brand&&r.category===f.category&&(!f.only||quantities.has(orderKey(r)))&&`${r.code} ${r.drug}`.toLowerCase().includes(String(f.query||'').trim().toLowerCase())),quantities,prices,f.sort,f.direction,f.date);}
export function orderExportRows(rows,quantities,prices,f){return selectOrderExport(rows,quantities,prices,f).map(r=>{
 const key=orderKey(r),raw=quantities.get(key)??'',q=Number(raw),valid=raw!==''&&Number.isInteger(q)&&q>=1&&q<=1000000;let p,issue=r.warning||'',price=orderPrice(r,prices),amount='';
 if(raw!==''&&!valid)issue=[issue,'確認訂量待核對'].filter(Boolean).join('；');
 try{p=priceCents(price);if(r.priceWarning&&!prices.has(key))issue=[issue,'單價待核對'].filter(Boolean).join('；');if(valid&&p!==undefined){if(!Number.isSafeInteger(q*p))throw Error();amount=q*p/100;}}catch{issue=[issue,'單價或金額待核對'].filter(Boolean).join('；');}
 return [r.drug,r.code,r.brand,r.category,r.bottles??'',valid?q:raw,p===undefined?price:p/100,amount,r.updated||'',r.stockout||'',r.shortage||'',issue];
 });}
export function exportOrder(rows,quantities,prices,f,now=new Date()){
 const data=orderExportRows(rows,quantities,prices,f);if(!data.length)throw Error('目前沒有符合條件的訂貨品項');
 const stamp=now.toLocaleString('sv-SE',{timeZone:'Asia/Taipei'}),sortLabels={code:'藥品／編號',drug:'藥名',bottles:'未拆封瓶數',periodLoss:'期間耗損量',quantity:'本次確認訂量',price:'單價',amount:'訂貨小計',updated:'原表更新欄'};
 return {count:data.length,filename:'廠商訂貨_'+f.brand+f.category+'_'+stamp.replace(/[-: ]/g,'')+'.xlsx',bytes:createXlsx([{name:'訂貨明細',widths:[28,16,14,12,18,20,20,22,20,18,18,30],rows:[['藥品名稱','編號','廠商','類別','未拆封瓶數','本次確認訂量（瓶）','單價（元／瓶）','訂貨小計（元）','原表更新欄','缺藥標記','缺藥率','核對事項'],...data]},{name:'匯出條件',filter:false,widths:[26,90],rows:[['項目','內容'],['匯出時間（台北）',stamp],['廠商',f.brand],['類別',f.category],['搜尋藥名或編號',f.query||'不限'],['只顯示已填品項',f.only?'是':'否'],['訂貨日期',f.date],['排序',(sortLabels[f.sort]||'藥品／編號')+'／'+(f.direction==='desc'?'降冪':'升冪')],['匯出品項數',data.length],['說明','本次確認訂量及單價取自目前畫面輸入；匯出不代表訂貨已入帳，不會修改工作表。'],['空白說明','訂量空白表示未訂貨；缺少單價或訂量無效時不計算小計。'],['範圍','只匯出目前廠商、類別與搜尋條件下的全部品項，保留目前排序。']]}])};
}
