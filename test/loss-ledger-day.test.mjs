import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ledgerSource = fs.readFileSync('gas/loss/ledger.gs', 'utf8');
const headers = ['日期','廠商／類別','藥品編號','藥品名稱','當日累計瓶數','版本','來源','核對狀態','備註','經手人','更新時間'];
const today = '2026-11-27';
const old = '2026-11-26';
const entry = (date, code, revision = 0) => [date, '科達單方', code, code, revision, revision, '測試', '已核對', '', '', ''];

function fixture(records) {
  const values = [headers, ...records];
  const ranges = [];
  const sheet = {
    getLastRow: () => values.length,
    getRange(row, column, height, width) {
      ranges.push({row, column, height, width});
      return {getValues: () => values.slice(row - 1, row - 1 + height).map(fields =>
        Array.from({length: width}, (_, i) => fields[column - 1 + i] ?? ''))};
    }
  };
  const context = vm.createContext({
    loss3Date_(v) {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw Error('日期格式錯誤');
      return v;
    },
    LossCumulative: {lossUnits(n) {assert.ok(Number.isInteger(n));}}
  });
  vm.runInContext(ledgerSource, context);
  return {ranges, read: () => context.lossLedgerReadScoped_({getSheetByName: () => sheet}, today).latest};
}

test('a daily read retrieves only the date column and relevant detail runs, including later corrections', () => {
  const records = Array.from({length: 500}, (_, i) => entry(old, 'old' + i));
  records[25] = entry(new Date(today), 'QA');
  records[480] = entry(today, 'QA', 1);
  const {ranges, read} = fixture(records);
  const latest = [...read().values()];
  assert.equal(latest.length, 1);
  assert.equal(latest[0].revision, 1);
  assert.equal(ranges.filter(r => r.width === 9).reduce((n,r) => n + r.height, 0), 2);
  assert.ok(ranges.some(r => r.width === 1 && r.height === 500));
});

test('a date with no records reads no detail, while a partially filled undated row still fails', () => {
  const emptyDay = fixture([entry(old, 'QA')]);
  assert.equal(emptyDay.read().size, 0);
  assert.ok(emptyDay.ranges.every(r => r.width !== 9));
  assert.equal(fixture([[], entry(today, 'QA')]).read().size, 1);
  assert.throws(() => fixture([entry('', 'QA')]).read(), /日期/);
});

test('fragmented dates preserve order, duplicate revisions and row validation', () => {
  const records = Array.from({length: 130}, (_, i) => i % 22 === 0
    ? entry(today, 'QA', i / 22)
    : entry(old, 'old' + i));
  const sorted = fixture(records);
  assert.equal([...sorted.read().values()][0].revision, 5);
  assert.ok(sorted.ranges.filter(r => r.width === 9).length <= 4);
  records.push(entry(today, 'QA', 4));
  assert.throws(() => fixture(records).read(), /版本重複或倒退/);
});
