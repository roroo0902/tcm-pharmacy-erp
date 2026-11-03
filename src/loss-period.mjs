// Calendar days are resolved in UTC after the caller supplies the Taipei date.
function periodDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('請使用完整日期 yyyy-mm-dd');
  const timestamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) throw Error('統計日期無效');
  return timestamp;
}

export function lossPeriod({days, includeToday} = {}, todayISO) {
  if (!['number', 'string'].includes(typeof days) || String(days).trim() === '') throw Error('請輸入統計天數');
  const count = Number(days);
  if (!Number.isInteger(count) || count < 1 || count > 3660) throw Error('統計天數須為 1 至 3660 的整數');
  if (typeof includeToday !== 'boolean') throw Error('請確認是否包含今天');
  const endTime = periodDate(todayISO) - (includeToday ? 0 : 86400000);
  const dates = Array.from({length: count}, (_, index) => new Date(endTime - (count - 1 - index) * 86400000).toISOString().slice(0, 10));
  return {days: count, includeToday, start: dates[0], end: dates[count - 1], dates, label: `近 ${count} 天耗損量`};
}

// Each value is the final cumulative total for that day, never an audit revision.
// Completion is source-wide: a recorded number alone does not confirm the day.
export function summarizeLossPeriod({dates, rows, completedDates = []}) {
  if (!Array.isArray(dates) || !dates.length || new Set(dates).size !== dates.length) throw Error('統計日期不可空白或重複');
  dates.forEach(periodDate);
  if (!Array.isArray(rows) || !Array.isArray(completedDates)) throw Error('耗損統計資料格式不符');
  const completed = new Set(completedDates);
  return rows.map(row => {
    const missingDates = dates.filter(date => !completed.has(date));
    let total = 0, error = '';
    for (const date of dates) {
      if (row.errors?.[date]) {
        error = `${date}：${row.errors[date]}`;
        break;
      }
      const value = row.values?.[date];
      if (value === null || value === undefined) continue;
      if (!Number.isSafeInteger(value) || value < 0) {
        error = `${date}：每日耗損須為非負整數，請核對原表`;
        break;
      }
      total += value;
      if (!Number.isSafeInteger(total)) {
        error = '期間耗損量超出可計算範圍';
        break;
      }
    }
    return {...row, total: error ? null : total, missingDates, complete: !error && missingDates.length === 0, error};
  });
}
