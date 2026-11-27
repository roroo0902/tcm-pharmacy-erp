const taipeiTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export function receiptLabel(time) {
  const date = time ? new Date(time) : null;
  const stamp = date && Number.isFinite(date.getTime()) ? taipeiTime.format(date) : '時間未記錄';
  return '進貨登入-' + stamp;
}
