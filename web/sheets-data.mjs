export const SHEET_ID='1jbiHJoDf730G7qLywlS4UA2tHW5lPRc6wExLW-7Pq4Q';
export const SOURCES=[{name:'科達單方',brand:'科達',category:'單方',gid:1146823028},{name:'科達複方',brand:'科達',category:'複方',gid:1565387175},{name:'天明單方',brand:'天明',category:'單方',gid:978630307},{name:'天明複方',brand:'天明',category:'複方',gid:1639737799},{name:'富田單方',brand:'富田',category:'單方',gid:1516427074},{name:'富田複方',brand:'富田',category:'複方',gid:497109521}];
export function csvRows(text){
 const rows=[];let row=[],field='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let p=0;p<text.length;p++){const c=text[p];if(c==='"'){if(quoted&&text[p+1]==='"'){field+='"';p++;}else if(quoted||field==='')quoted=!quoted;else throw Error('CSV引號格式錯誤');}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[p+1]==='\n')p++;row.push(field);rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('CSV內容不完整');if(field!==''||row.length){row.push(field);rows.push(row);}return rows;
}
export function parseSheet(text,source){
 const rows=csvRows(text);if(rows[0]?.[1]!=='編號'||rows[0]?.[3]!=='藥品名稱'||rows[1]?.[6]!=='未拆封')throw Error('原表欄位已變更，請先核對欄位設定');
 const result=[];for(let p=2;p<rows.length;p++){const r=rows[p];if(!r[3]?.trim())continue;const raw=r[6]?.trim()??'',n=/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)?Number(raw):null;const bottles=Number.isFinite(n)?n:null;result.push({id:source.gid+':'+(p+1),row:p+1,...source,code:r[1]?.trim()??'',drug:r[3].trim(),stockRaw:raw,bottles,...sheetPrice(r[4]),updated:r[5]??'',stockout:r[10]??'',shortage:r[11]??'',arrival:r[12]??'',warning:!r[1]?.trim()?'缺編號':raw===''?'未填庫存':bottles===null?'瓶數格式待核對':bottles<0?'負庫存':''});}
 const codes=new Map();for(const r of result)if(r.code)codes.set(r.code,(codes.get(r.code)??0)+1);for(const r of result)if(codes.get(r.code)>1)r.warning=[r.warning,'同分頁編號重複'].filter(Boolean).join('；');
 return result;
}
export function sheetUrl(source){return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${source.gid}`;}
export function exportUrl(source){return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${source.gid}&range=A1:M5000`;}
// Daily columns are appended over time. Keep the order feed as wide as the loss feed.
export function dailyExportUrl(source){return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${source.gid}&range=A1:ZZ5000`;}
import {sheetPrice} from './receipt-pricing.mjs';
