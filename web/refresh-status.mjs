export function createRefreshStatus(button, now = () => new Date()) {
 const label = button.textContent;
 const status = button.ownerDocument.createElement('span');
 status.className = 'muted refresh-status';
 status.setAttribute('role', 'status');
 status.setAttribute('aria-live', 'polite');
 button.insertAdjacentElement('afterend', status);
 let lastUpdated = '';
 return {
  start() {
   button.disabled = true;
   button.textContent = '讀取中…';
   button.setAttribute('aria-busy', 'true');
   status.textContent = '正在讀取工作表，已填數量保留。';
  },
  finish(success) {
   button.disabled = false;
   button.textContent = label;
   button.setAttribute('aria-busy', 'false');
   if (success) lastUpdated = now().toLocaleString('zh-TW', {timeZone:'Asia/Taipei',hour12:false});
   status.textContent = success ? '更新時間：' + lastUpdated : '讀取失敗，已填數量保留。' + (lastUpdated ? '上次更新：' + lastUpdated : '請重試。');
  }
 };
}
