import {createXlsx} from './xlsx-export.mjs';
import {sortSheetRows} from './sheets-sort.mjs';
export const inventoryLabels={all:'符合品項',zero:'零庫存',warning:'待核對'};
export function filterInventory(rows,f={}){return rows.filter(r=>(!f.brand||r.brand===f.brand)&&(!f.category||r.category===f.category)&&[r.drug,r.code].join(' ').toLowerCase().includes(String(f.q||'').toLowerCase()));}
export function selectInventory(rows,f={}){return sortSheetRows(filterInventory(rows,f).filter(r=>f.status==='zero'?r.bottles===0:f.status==='warning'?Boolean(r.warning):true),f.sortKey,f.sortDirection,f.sortYear);}
export function exportInventory(rows,f={},sources=[],now=new Date()){
 const selected=selectInventory(rows,f);if(!selected.length)throw Error('目前沒有符合條件的品項');
 const stamp=now.toLocaleString('sv-SE',{timeZone:'Asia/Taipei'}),label=inventoryLabels[f.status]||inventoryLabels.all;
 const sortLabels={code:'編號',drug:'藥品名稱',brand:'廠牌／類別',price:'單價',bottles:'未拆封瓶數',updated:'原表更新欄',stockout:'缺藥標記',shortage:'缺藥率',warning:'核對事項'};
 const sheets=[{name:'庫存明細',widths:[26,16,14,12,20,18,20,18,18,30,24],rows:[['藥品名稱','編號','廠牌','類別','單價（元／瓶）','未拆封瓶數','原表更新欄','缺藥標記','缺藥率','核對事項','單價核對'],...selected.map(r=>[r.drug,r.code,r.brand,r.category,Number.isFinite(r.unitPriceCents)?r.unitPriceCents/100:r.priceRaw||'',Number.isFinite(r.bottles)?r.bottles:r.stockRaw||'',r.updated,r.stockout,r.shortage,r.warning,r.priceWarning||''])]},
 {name:'匯出條件',filter:false,widths:[26,90],rows:[['項目','內容'],['匯出時間（台北）',stamp],['明細分類',label],['搜尋藥名或編號',f.q||'不限'],['廠牌',f.brand||'全部廠牌'],['類別',f.category||'單方與複方'],['排序',(sortLabels[f.sortKey]||'編號')+'／'+(f.sortDirection==='desc'?'降冪':'升冪')],['匯出品項數',selected.length],['說明','匯出目前條件下全部品項，包含其他頁；僅讀取，不修改庫存或紀錄。'],['原表更新欄','保留原表文字，只有月／日不補年份；同步時間不代表盤點時間。'],...sources.map(s=>['來源同步：'+s.name,new Date(s.time).toLocaleString('sv-SE',{timeZone:'Asia/Taipei'})])]}];
 return {count:selected.length,filename:'庫存總覽_'+label+'_'+stamp.replace(/[-: ]/g,'')+'.xlsx',bytes:createXlsx(sheets)};
}
