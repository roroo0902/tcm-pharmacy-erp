export const lossReasons = [
 ['quantity','數量誤填','原登錄數量有誤，依實際耗損更正累計。'],
 ['duplicate','重複登錄','同一筆耗損重複登錄，扣除重複數量。'],
 ['count','盤點核對更正','經實際盤點與耗損紀錄核對，修正原登錄累計。'],
 ['item','藥品選錯','耗損誤登於此藥品，調整或歸零此品項累計。'],
 ['date','日期選錯','耗損誤登於此日期，調整或歸零當日累計。'],
 ['supplier','廠牌／分類選錯','耗損誤登於此廠牌或單複方分類，更正原登錄。'],
 ['unused','未實際耗用','原先登錄的數量未實際耗用，調整或歸零累計。'],
 ['other','其他原因','']
];
export function validateLossReason(kind, reason, required) {
 if(required && !lossReasons.some(([id])=>id===kind))throw Error('調低累計或歸零請選擇更正原因');
 if((required||kind==='other')&&!String(reason??'').trim())throw Error('請填寫更正原因說明');
 return reason;
}
export function lossReasonHint(kind){return ['item','date','supplier'].includes(kind)?'本次只更正原紀錄，正確項目需另行登錄。':'選擇原因後自動帶入說明，可再補充細節。';}
