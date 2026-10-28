// Pure V3 accounting. Daily loss is counted in whole jars; never round submitted values.
export function lossUnits(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1000000) throw Error('罐數須為 0 或正整數，不接受小數；既有小數資料請先核對');
  return value;
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
    return {...row, delta, stockAfter: stock - delta, reason: String(row.reason || reason).trim()};
  });
}
