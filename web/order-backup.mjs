import {validateOrderStore} from '../src/orders.mjs';
import {today} from './store.mjs';

export function mountOrderBackup(host, ask, message) {
  const key = 'tcm-purchase-v2';
  host.insertAdjacentHTML('beforeend', `<details class="panel"><summary>本機訂貨草稿備份與還原</summary>
    <p class="muted">匯出這個瀏覽器的訂貨草稿及已確認紀錄，或從先前的訂貨備份還原。</p>
    <div class="actions"><button type="button" class="secondary" id="order-backup">匯出全部訂貨備份</button>
    <label>還原訂貨備份<input id="order-restore" type="file" accept=".json,application/json"></label></div>
  </details>`);

  host.querySelector('#order-backup').onclick = () => {
    try {
      const raw = localStorage.getItem(key);
      const {drafts, orders} = validateOrderStore(raw === null ? {drafts: {}, orders: []} : JSON.parse(raw));
      const backup = {kind: 'tcm-purchase-backup', version: 2, drafts, orders};
      const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '訂貨備份_' + today() + '.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      message(error.message, true);
    }
  };

  host.querySelector('#order-restore').onchange = async event => {
    const input = event.target;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > 10000000) throw Error('備份超過10MB');
      const backup = JSON.parse(await file.text());
      if (backup?.kind !== 'tcm-purchase-backup' || backup.version !== 2) throw Error('訂貨備份格式錯誤');
      const {drafts, orders} = validateOrderStore(backup);
      const previous = localStorage.getItem(key);
      ask('<p>還原會取代本機訂貨草稿及確認紀錄，請先匯出目前備份。</p>', async () => {
        try {
          await navigator.locks.request(key, () => {
            if (localStorage.getItem(key) !== previous) throw Error('本機訂貨資料已變更，請重新選擇備份檔並核對。');
            localStorage.setItem(key, JSON.stringify({drafts, orders}));
          });
          message('訂貨備份已還原');
        } catch (error) {
          message(error.message, true);
        }
      }, '確認還原', '取消');
    } catch (error) {
      message(error.message, true);
    }
  };
}
