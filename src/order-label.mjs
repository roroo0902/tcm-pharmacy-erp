export function orderLabel(time) {
  // Legacy sheet timestamps without an offset were recorded in Taipei local time.
  let value = time;
  if (typeof time === 'string') {
    const local = time.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (local) {
      const [,year,month,day,hour,minute,second='00'] = local;
      value = year + '-' + month.padStart(2,'0') + '-' + day.padStart(2,'0') + 'T' + hour.padStart(2,'0') + ':' + minute + ':' + second + '+08:00';
    } else if (!/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(time.trim())) {
      return '訂貨登入-時間未記錄';
    }
  }
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return '訂貨登入-時間未記錄';
  return '訂貨登入-' + date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
}

export function transactionLabel(draft, time) {
  return ['訂貨', '取消訂貨'].includes(draft.action) ? orderLabel(time) : draft.id;
}
