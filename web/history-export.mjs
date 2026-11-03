import {filterHistoryEntries} from './history-display.mjs';
import {createXlsx} from './xlsx-export.mjs';
function dateCell(value){const m=String(value??'').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);if(!m)return value;const iso=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'),d=new Date(iso+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===iso?d:value;}
export function historyWorkbook(entries,filters,now=new Date()){
 const selected=filterHistoryEntries(entries,filters);if(!selected.length)throw Error('目前沒有符合條件的紀錄，請調整篩選後再匯出');
 const headers=['日期','交易類型','藥品／編號與數量','結果','經手人','測試標記','原耗損累計（瓶）','新耗損累計（瓶）','耗損差額（瓶；正扣負加）','此筆入帳後庫存（歷史）','備註','交易編號','對應原交易','記錄時間'];
 const rows=selected.map(e=>[dateCell(e.date),e.label,e.lines.length?e.lines.map(l=>[l.sheet,l.name,l.code,e.type==='耗損'?'當日累計 '+e.total+' 瓶':(e.type==='建帳'?'期初 ':e.action==='沖銷'?'沖銷 ':e.action==='取消訂貨'?'取消訂貨 ':e.type==='訂貨'?'訂貨 ':'進貨 ')+(l.quantity??'待核對')+' 瓶'].filter(Boolean).join(' · ')).join('\n'):e.fallback,e.status,e.actor||'未記錄',e.marked?'測試紀錄':'未標記測試',e.before,e.total,e.delta,e.stock,e.note||'',e.id,e.reverses,e.time]);
 const stamp=now.toLocaleString('sv-SE',{timeZone:'Asia/Taipei'}),test=filters.test==='測試'?'有測試標記':filters.test==='全部'?'全部紀錄':'未標記測試';
 return {count:selected.length,filename:'交易紀錄_'+stamp.replace(/[-: ]/g,'')+'.xlsx',sheets:[{name:'交易紀錄',rows:[headers,...rows],widths:[14,14,65,32,16,18,18,18,24,24,55,43,43,28]},{name:'匯出條件',filter:false,widths:[24,90],rows:[['項目','內容'],['匯出時間（台北）',stamp],['交易類型',filters.type||'全部'],['測試標記',test],['開始日期（含）',filters.from||'不限'],['結束日期（含）',filters.to||'不限'],['藥品／編號搜尋',filters.drug||'不限'],['經手人搜尋',filters.actor||'不限'],['匯出交易筆數',selected.length],['已讀取總筆數',entries.length],['說明','每列為一筆交易，包含該交易全部品項；搜尋命中的交易不會截斷其他品項。'],['資料範圍','匯出目前頁面已讀取的紀錄；不寫入庫存、不修改或刪除交易。'],['測試紀錄','依既有測試標記篩選；未標記不等於已人工確認為正式交易。'],['庫存欄','此筆入帳後庫存為歷史數字，不是目前庫存；非耗損交易留白。']]}]};
}
export function exportHistory(entries,filters,now){const book=historyWorkbook(entries,filters,now);return {bytes:createXlsx(book.sheets),filename:book.filename,count:book.count};}
