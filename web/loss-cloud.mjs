import {csvRows,parseSheet,SHEET_ID} from './sheets-data.mjs?v=compact20261030';
export const LOSS_ENDPOINT='https://script.google.com/macros/s/AKfycbwsXafoCVk_UzEwqhTD4shlbLerTzPh1sxv1EH8wxjTovy_fZUNH6F8btpo_oYLYUVF4Q/exec';
export const LOSS_SHEET='https://docs.google.com/spreadsheets/d/1zQr0awr9wJr2Fbsk2PQgiMd1C640AokVmT2pPU9-fU4/edit';
export function lossExportUrl(source){return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${source.gid}&range=A1:ZZ5000`;}
export function parseLossSheet(text,source,date){
 const grid=csvRows(text),columns=[];
 for(let c=13;c<(grid[0]||[]).length;c++)if((grid[0][c]||'').replaceAll('/','-')===date&&/^[一二三四五六日]$/.test(grid[1]?.[c]))columns.push(c);
 return parseSheet(text,source).map(r=>{const raw=columns.length===1?(grid[r.row-1][columns[0]]??''):null;const n=raw===''?0:raw!==null&&/^\d+(\.\d+)?$/.test(raw)?Number(raw):null;return {...r,posted:n};});
}
export function lossDraft(lines,{date,actor,reason}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date).toISOString().slice(0,10)!==date)throw Error('請選擇耗損日期');
 if(!String(actor).trim())throw Error('請填經手人');if(!lines.length)throw Error('請至少填一項當日累計');
 const seen=new Set();const result=lines.map(({row,total})=>{const key=JSON.stringify([row.name,row.code]);if(seen.has(key))throw Error('藥品重複');seen.add(key);if(!Number.isInteger(total)||total<0||total>1000000)throw Error('累計罐數須為 0 或正整數，不接受小數');if(row.posted!==null&&total<row.posted&&!reason.trim())throw Error('調低累計或歸零請填更正原因');return {sheet:row.name,code:row.code,name:row.drug,total};});
 return {kind:'tcm-loss-cumulative',version:3,date,actor:actor.trim(),reason:reason.trim(),lines:result};
}
