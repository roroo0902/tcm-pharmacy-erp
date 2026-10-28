// Pure planner shared by Node tests and the bound Apps Script.
export function lossNumber(value, label, blankZero = false) {
  if (value === '' || value == null) {
    if (blankZero) return 0;
    throw new Error(label + '未填');
  }
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value.trim()))) {
    throw new Error(label + '必須為非負數字');
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(label + '必須為有限非負數');
  return n;
}

export function planLoss(snapshot) {
  const text = v => String(v == null ? '' : v).trim();
  const ledger = new Map();
  for (const entry of snapshot.ledger) {
    if (!entry.key || ledger.has(entry.key) || !entry.name ||
        !Number.isFinite(entry.qty) || entry.qty <= 0) throw new Error('耗損交易紀錄損壞或重複');
    ledger.set(entry.key, entry);
  }
  const entries = [], updates = [], acknowledged = [];
  for (const sheet of snapshot.sheets) {
    if (text(sheet.source.values[0][1]) !== '編號' || text(sheet.source.values[0][2]) !== '藥品名稱' ||
        text(sheet.inventory.values[0][1]) !== '編號' || text(sheet.inventory.values[0][3]) !== '藥品名稱' ||
        text(sheet.inventory.values[1][6]) !== '未拆封' || text(sheet.inventory.values[1][5]) !== '時間') {
      throw new Error(sheet.name + '表頭與設定不符');
    }
    const byCode = new Map(), sourceCodes = new Set(), pending = new Map();
    sheet.inventory.values.slice(2).forEach((row, index) => {
      const code = text(row[1]);
      if (!code) return;
      if (byCode.has(code)) throw new Error(sheet.name + '庫存編號重複：' + code);
      byCode.set(code, { row, index: index + 2 });
    });
    sheet.source.values.slice(2).forEach((row, index) => {
      const code = text(row[1]), name = text(row[2]), r = index + 2;
      if (code) {
        if (sourceCodes.has(code)) throw new Error(sheet.name + '耗損編號重複：' + code);
        sourceCodes.add(code);
      }
      for (let col = 3; col <= 5; col++) {
        const qty = lossNumber(row[col], sheet.name + '第' + (r + 1) + '列耗損', true);
        // Fixed dates are required even on zero cells with an existing transaction.
        // Blank/zero cells without a usable date cannot create a new transaction.
        const date = sheet.source.dates[col - 3];
        if (!qty && !date) continue;
        if (!date || sheet.source.formulas[0][col]) {
          if (qty) throw new Error(sheet.name + 'D1:F1請改為含年份的固定日期，不可使用TODAY公式');
          continue;
        }
        const key = JSON.stringify([snapshot.sourceId, sheet.source.id, date, code, col]);
        const previous = ledger.get(key);
        if (previous) {
          if (previous.qty !== qty || previous.name !== name) throw new Error(sheet.name + ' ' + code + '已入帳數量或藥名被修改；請先核對交易，不可直接重扣');
          acknowledged.push({ sheetId: sheet.source.id, row: r, col, date, qty, key });
          continue;
        }
        if (!qty) continue;
        if (sheet.source.formulas[r][col]) throw new Error('耗損數量須為固定值，不可使用公式');
        if (!code || !name) throw new Error(sheet.name + '第' + (r + 1) + '列缺編號或藥名');
        const note = sheet.source.notes[r][col] || '';
        if (note.includes('已扣庫存')) throw new Error(sheet.name + ' ' + code + '有舊扣庫註記，需先核對歷史及清理，禁止自動重扣');
        const target = byCode.get(code);
        if (!target || text(target.row[3]) !== name) throw new Error(sheet.name + '編號／藥名不一致：' + code + ' ' + name);
        const matches = [];
        for (let c = 13; c < sheet.inventory.values[0].length; c++) {
          if (/^(?:[一二三四五六日]|週[一二三四五六日]|星期[一二三四五六日])$/.test(text(sheet.inventory.values[1][c])) &&
              sheet.inventory.dates[c] === date) matches.push(c);
        }
        if (matches.length !== 1) throw new Error(sheet.name + '找不到唯一完整日期欄：' + date);
        const dayCol = matches[0];
        if (sheet.inventory.formulas[target.index][6] || sheet.inventory.formulas[target.index][dayCol] ||
            sheet.inventory.formulas[target.index][5]) throw new Error('預計寫入的庫存、日期或更新時間格含公式，停止');
        let state = pending.get(target.index);
        if (!state) {
          state = { stock: lossNumber(target.row[6], sheet.name + ' ' + code + '庫存'), days: new Map() };
          pending.set(target.index, state);
        }
        const before = state.stock;
        if (qty > before) throw new Error(sheet.name + ' ' + code + '庫存不足');
        state.stock = Number((state.stock - qty).toFixed(9));
        const dayBefore = state.days.has(dayCol) ? state.days.get(dayCol) : lossNumber(target.row[dayCol], '每日耗損', true);
        const dayAfter = Number((dayBefore + qty).toFixed(9));
        if (!Number.isFinite(dayAfter)) throw new Error('每日耗損加總超出範圍');
        state.days.set(dayCol, dayAfter);
        entries.push({ key, date, qty, code, name, sourceSheetId: sheet.source.id, sourceRow: r + 1,
          sourceColumn: col + 1, targetSheetId: sheet.inventory.id, targetRow: target.index + 1,
          stockBefore: before, stockAfter: state.stock, dayBefore, dayAfter });
        acknowledged.push({ sheetId: sheet.source.id, row: r, col, date, qty, key });
      }
    });
    for (const [row, state] of pending) {
      updates.push({ sheetId: sheet.inventory.id, row, col: 6, value: state.stock });
      updates.push({ sheetId: sheet.inventory.id, row, col: 5, value: snapshot.executedDate });
      for (const [col, value] of state.days) updates.push({ sheetId: sheet.inventory.id, row, col, value });
    }
  }
  return { entries, updates, acknowledged };
}
