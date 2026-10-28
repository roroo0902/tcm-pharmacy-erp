// Pure V3 accounting. Quantities are hundredths of a bottle.
export function lossUnits(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) throw Error('瓶數須為非負數，最多兩位小數');
  return Math.round(value * 100);
}
export function planCumulative(rows, reason = '') {
  const seen = new Set();
  return rows.map(row => {
    if (seen.has(row.key)) throw Error('同日期與藥品重複，請合併後送出');
    seen.add(row.key);
    const before = lossUnits(row.before), after = lossUnits(row.total), stock = lossUnits(row.stock);
    const delta = after - before;
    if (delta < 0 && !String(row.reason || reason).trim()) throw Error(row.name + '：調低累計或歸零須填寫更正原因');
    if (stock - delta < 0) throw Error(row.name + '：庫存不足，請先核對庫存');
    return {...row, delta: delta / 100, stockAfter: (stock - delta) / 100, reason: String(row.reason || reason).trim()};
  });
}
