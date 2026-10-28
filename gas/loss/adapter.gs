const LOSS_CONFIG = Object.freeze({
  sourceId: '1zQr0awr9wJr2Fbsk2PQgiMd1C640AokVmT2pPU9-fU4',
  inventoryId: '1jbiHJoDf730G7qLywlS4UA2tHW5lPRc6wExLW-7Pq4Q',
  names: ['科達單方', '科達複方'], ledgerName: '耗損V2_交易紀錄', ledgerId: 918000101
});

function lossDate_(value, tz) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  if (typeof value !== 'string' || !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(value.trim())) return null;
  const parts = value.trim().split(/[-/]/).map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (d.getUTCFullYear() !== parts[0] || d.getUTCMonth() !== parts[1] - 1 || d.getUTCDate() !== parts[2]) return null;
  return parts[0] + '-' + String(parts[1]).padStart(2, '0') + '-' + String(parts[2]).padStart(2, '0');
}

function lossRead_() {
  const source = SpreadsheetApp.getActiveSpreadsheet();
  if (!source || source.getId() !== LOSS_CONFIG.sourceId) throw new Error('此程式只能在指定的藥品耗損表執行');
  const inventory = SpreadsheetApp.openById(LOSS_CONFIG.inventoryId);
  const tz = source.getSpreadsheetTimeZone();
  if (tz !== inventory.getSpreadsheetTimeZone()) throw new Error('來源與庫存表時區不一致');
  const snapshot = { sourceId: source.getId(), executedDate: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), ledger: [], sheets: [] };
  const log = inventory.getSheetByName(LOSS_CONFIG.ledgerName);
  if (log) {
    const rows = log.getDataRange().getValues();
    if (rows[0][0] !== '交易ID' || rows[0][1] !== '交易JSON_V2') throw new Error('交易紀錄表頭不符，停止');
    snapshot.ledger = rows.slice(1).map(row => {
      const entry = JSON.parse(row[1]);
      if (entry.key !== row[0]) throw new Error('交易紀錄ID不一致');
      return entry;
    });
  } else if (inventory.getSheets().some(s => s.getSheetId() === LOSS_CONFIG.ledgerId)) {
    throw new Error('預設交易紀錄分頁ID已被使用');
  }
  LOSS_CONFIG.names.forEach(name => {
    const src = source.getSheetByName(name), dst = inventory.getSheetByName(name);
    if (!src || !dst) throw new Error('缺少分頁：' + name);
    const sr = src.getRange(1, 1, Math.max(3, src.getLastRow()), 6);
    const ir = dst.getRange(1, 1, Math.max(3, dst.getLastRow()), Math.max(14, dst.getLastColumn()));
    const sv = sr.getValues(), iv = ir.getValues();
    snapshot.sheets.push({ name,
      source: { id: src.getSheetId(), values: sv, formulas: sr.getFormulas(), notes: sr.getNotes(), dates: sv[0].slice(3, 6).map(v => lossDate_(v, tz)) },
      inventory: { id: dst.getSheetId(), values: iv, formulas: ir.getFormulas(), dates: iv[0].map(v => lossDate_(v, tz)) }
    });
  });
  return { source, inventory, snapshot, log };
}

function lossToken_(snapshot) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(snapshot)));
}

// No writes: safe to run from the Apps Script editor during installation.
function lossV2ReadOnlyCheck() {
  const state = lossRead_();
  const plan = LossEngine.planLoss(state.snapshot);
  const result = { token: lossToken_(state.snapshot), count: plan.entries.length,
    bottles: plan.entries.reduce((n, e) => n + e.qty, 0),
    alreadyPosted: plan.acknowledged.length - plan.entries.length,
    lines: plan.entries.map(e => e.date + ' ' + e.code + ' ' + e.name + '：' + e.qty + ' 瓶，剩餘 ' + e.stockAfter) };
  console.log(JSON.stringify(result));
  return result;
}

function lossCellRequest_(sheetId, rowIndex, columnIndex, value) {
  return { updateCells: { start: { sheetId, rowIndex, columnIndex },
    rows: [{ values: [{ userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: value } }] }], fields: 'userEnteredValue' } };
}

function lossRequests_(state, plan, actor, timestamp) {
  if (!plan.entries.length) return [];
  const sheetId = state.log ? state.log.getSheetId() : LOSS_CONFIG.ledgerId;
  const requests = [];
  if (!state.log) {
    requests.push({ addSheet: { properties: { sheetId, title: LOSS_CONFIG.ledgerName, gridProperties: { rowCount: 1000, columnCount: 2, frozenRowCount: 1 } } } });
    requests.push({ updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: [{ values: [
      { userEnteredValue: { stringValue: '交易ID' } }, { userEnteredValue: { stringValue: '交易JSON_V2' } }
    ] }], fields: 'userEnteredValue' } });
  }
  plan.updates.forEach(u => requests.push(lossCellRequest_(u.sheetId, u.row, u.col, u.value)));
  // A stable, server-unique ID also rejects a late duplicate batch after a timeout.
  // These named ranges are durable transaction guards; never remove them independently.
  plan.entries.forEach(entry => {
    const id = 'loss_v2_' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, entry.key)
      .map(b => (b & 255).toString(16).padStart(2, '0')).join('');
    requests.push({ addNamedRange: { namedRange: { namedRangeId: id, name: id,
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 } } } });
  });
  requests.push({ appendCells: { sheetId, rows: plan.entries.map(entry => ({ values: [
    { userEnteredValue: { stringValue: entry.key } },
    { userEnteredValue: { stringValue: JSON.stringify(Object.assign({}, entry, { actor, timestamp })) } }
  ] })), fields: 'userEnteredValue' } });
  return requests;
}

function syncLossToInventory(token) {
  if (!token || typeof token !== 'string') throw new Error('請從耗損表選單先預覽，再確認扣庫');
  if (typeof Sheets === 'undefined') throw new Error('請先啟用 Google Sheets API 進階服務');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('另一筆耗損正在處理，請稍後重新預覽');
  try {
    const state = lossRead_();
    if (lossToken_(state.snapshot) !== token) throw new Error('資料已變動，請關閉視窗並重新預覽；尚未執行本次寫入');
    const actor = Session.getActiveUser().getEmail();
    if (!actor) throw new Error('無法取得經手人帳號，請由有編輯權限的帳號執行');
    const plan = LossEngine.planLoss(state.snapshot);
    const requests = lossRequests_(state, plan, actor, new Date().toISOString());
    // Stock, daily total and durable transaction keys commit in ONE target spreadsheet batch.
    // A timeout must not be blindly retried using old values; a fresh preview rereads the ledger.
    if (requests.length) Sheets.Spreadsheets.batchUpdate({ requests }, LOSS_CONFIG.inventoryId);
    let warning = '';
    try {
      // Notes are only a display aid. The target ledger is the authority for retry protection.
      plan.acknowledged.forEach(a => {
        const sheet = state.source.getSheets().find(s => s.getSheetId() === a.sheetId);
        const cell = sheet.getRange(a.row + 1, a.col + 1);
        if (Number(cell.getValue()) !== a.qty) throw new Error('來源輸入已變動');
        const marker = '已扣庫存 V2 ' + a.date + ' ' + a.qty + '瓶';
        if (!cell.getNote().includes(marker)) cell.setNote((cell.getNote() + '\n' + marker).trim());
      });
    } catch (e) { warning = '庫存及交易紀錄已入帳，但部分註記未更新。請重新預覽核對，不要清除交易紀錄。'; }
    return { count: plan.entries.length, bottles: plan.entries.reduce((n, e) => n + e.qty, 0), warning };
  } catch (e) {
    throw new Error(e.message + '\n若發生連線中斷或逾時，結果可能已入帳；請重新預覽，系統會讀取交易紀錄確認，勿手動重扣。');
  } finally { lock.releaseLock(); }
}

function openCuteConfirmDialog() {
  let preview;
  try { preview = lossV2ReadOnlyCheck(); }
  catch (e) { SpreadsheetApp.getUi().alert('停止扣庫', e.message, SpreadsheetApp.getUi().ButtonSet.OK); return; }
  const data = JSON.stringify(preview).replace(/</g, '\\u003c');
  const html = '<!doctype html><meta charset="utf-8"><style>body{font:16px sans-serif;padding:20px}pre{white-space:pre-wrap}button{padding:12px;margin:8px}</style>' +
    '<h2>每日耗損核對</h2><pre id="preview"></pre><button id="confirm" onclick="submitLoss()">確認扣庫</button><button onclick="google.script.host.close()">關閉</button><p id="result"></p><script>' +
    'const p=' + data + ';document.getElementById("preview").textContent="本次 "+p.count+" 筆，共 "+p.bottles+" 瓶；已入帳 "+p.alreadyPosted+" 格\\n"+p.lines.join("\\n");' +
    'function submitLoss(){document.getElementById("confirm").disabled=true;document.getElementById("result").textContent="處理中，請勿重複執行…";' +
    'google.script.run.withSuccessHandler(r=>{document.getElementById("result").textContent="已完成："+r.count+" 筆，"+r.bottles+" 瓶。"+r.warning;})' +
    '.withFailureHandler(e=>{document.getElementById("result").textContent=e.message+" 請關閉並重新預覽。";}).syncLossToInventory(p.token);}</script>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(620).setHeight(550), '每日耗損 V2');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('💊 庫存管理系統').addItem('▶️ 預覽每日耗損並同步', 'openCuteConfirmDialog').addToUi();
  if (typeof lossItemsMenuLegacy_ === 'function') lossItemsMenuLegacy_();
}
