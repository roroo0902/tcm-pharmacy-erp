import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const dates = ['2026-11-01', '2026-11-02', '2026-11-03'];
const source = {name: '驗收單方', brand: '驗收', category: '單方', gid: 101};
const statusHeaders = ['日期', '廠商／類別', '登錄狀態', '經手人', '更新時間', '資料指紋'];
const copy = value => structuredClone(value);
function harness() {
  const headers = Array(17).fill(''), weekdays = Array(17).fill('');
  headers[1] = '編號'; headers[3] = '藥品名稱'; weekdays[6] = '未拆封';
  headers[13] = new Date('2026-10-31T16:00:00Z'); weekdays[13] = '日';
  headers[14] = new Date('2026-11-01T16:00:00Z'); weekdays[14] = '一';
  headers[15] = new Date('2026-11-02T16:00:00Z'); weekdays[15] = '本周耗損合計';
  headers[16] = new Date('2026-11-02T16:00:00Z'); weekdays[16] = '二';
  const first = Array(17).fill(''), second = Array(17).fill('');
  first[1] = 'QA1'; first[3] = '測試藥一'; first[6] = 50; first[13] = 3; first[14] = 5; first[15] = 99; first[16] = 2;
  second[1] = 'QA2'; second[3] = '測試藥二'; second[6] = 40; second[14] = 0;
  const states = [
    {id: 101, name: source.name, values: [headers, weekdays, first, second], formulas: []},
    {id: 102, name: '訂貨統計設定', values: [['設定', '值'], ['擷取天數', 3], ['包含今天', true], ['統計起日', ''], ['統計迄日', ''], ['設定狀態', '設定完成']]},
    {id: 103, name: '耗損登錄狀態', values: [statusHeaders]},
    {id: 104, name: '耗損V3_更正紀錄', values: [['版本ID', '交易JSON_V3']]}
  ];
  let available = true, released = 0, rejectBatch = false;
  const batches = [];
  const state = name => states.find(s => s.name === name);
  const sheet = s => ({
    getSheetId: () => s.id,
    getLastRow: () => s.values.length,
    getLastColumn: () => Math.max(...s.values.map(r => r.length)),
    getRange: (r, c, n = 1, m = 1) => {
      if (r === 'B2:B3') { r = 2; c = 2; n = 2; m = 1; }
      const values = () => Array.from({length: n}, (_, i) => Array.from({length: m}, (_, j) => s.values[r - 1 + i]?.[c - 1 + j] ?? ''));
      return {getValues: values, setValues: rows => rows.forEach((row, i) => row.forEach((value, j) => { s.values[r - 1 + i] ??= []; s.values[r - 1 + i][c - 1 + j] = value; }))};
    },
    getDataRange: () => ({getValues: () => copy(s.values), getFormulas: () => copy(s.formulas || [])})
  });
  const book = {getSheetByName: name => { const s = state(name); return s ? sheet(s) : null; }};
  const dateString = date => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'}).format(date);
  const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const apply = ({requests}) => {
    if (rejectBatch) throw Error('fixture atomic rejection');
    batches.push(copy(requests));
    for (const request of requests) {
      if (request.addNamedRange) continue;
      if (request.appendCells || request.updateCells) {
        const u = request.appendCells || request.updateCells;
        const s = states.find(s => s.id === (u.sheetId ?? u.start.sheetId));
        if (!s) throw Error('fixture unknown sheet');
        const firstRow = request.appendCells ? s.values.length : u.start.rowIndex;
        const firstColumn = request.appendCells ? 0 : u.start.columnIndex;
        u.rows.forEach((row, i) => row.values.forEach((cell, j) => {
          s.values[firstRow + i] ??= [];
          const v = cell.userEnteredValue;
          s.values[firstRow + i][firstColumn + j] = v?.stringValue ?? v?.numberValue ?? v?.boolValue ?? '';
        }));
      } else throw Error('fixture unhandled request');
    }
  };
  const ctx = vm.createContext({Date, console, LOSS3: {inventory: 'inventory', log: '耗損V3_更正紀錄'},
    SpreadsheetApp: {openById: () => book, flush() {}},
    Utilities: {formatDate: dateString}, erpOrderSources_: () => [source],
    loss3Date_: value => {
      if (value instanceof Date) return dateString(value);
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Error('日期格式錯誤');
      return value;
    }, loss3Hash_: hash,
    LockService: {getScriptLock: () => ({tryLock: () => available, releaseLock: () => released++})},
    Sheets: {Spreadsheets: {batchUpdate: apply}}
  });
  vm.runInContext(fs.readFileSync('gas/cloud/Period.gs', 'utf8'), ctx);
  ctx.periodToday_ = () => dates[2];
  return {ctx, state, book, batches, apply, hash, released: () => released, setLock: value => available = value, setReject: value => rejectBatch = value,
    read: input => ctx.periodRead_(input), day: date => ctx.periodDay_({date, sheet: source.name}),
    complete: date => { const day = ctx.periodDay_({date, sheet: source.name}); return ctx.periodComplete_({...day, actor: '隔離測試員', confirmBlankZero: true}); },
    event: (date, total, revision = 1, code = 'QA1', name = '測試藥一') => state('耗損V3_更正紀錄').values.push(['revision-' + revision, JSON.stringify({date, sheet: source.name, code, name, total, revision})])};
}

test('period backend uses Taipei raw dates, final daily totals, and excludes weekly subtotal columns', () => {
  const h = harness();
  h.event(dates[1], 3, 1); h.event(dates[1], 5, 2);
  const before = copy(h.state(source.name).values), result = h.read();
  assert.equal(result.period.start, dates[0]);
  assert.equal(result.period.end, dates[2]);
  assert.equal(result.rows[0].total, 10);
  assert.equal(result.rows[0].complete, false);
  assert.equal(result.rows[1].total, 0);
  assert.deepEqual(Array.from(result.completion[source.name].filter(day => !day.complete), day => day.date), dates);
  assert.deepEqual(h.state(source.name).values, before);
  assert.equal(h.batches.length, 0);
});

test('period settings permit custom periods, reject blank defaults, and round-trip saved values', () => {
  const h = harness();
  const settings = h.state('訂貨統計設定');
  settings.values[1][1] = '';
  assert.throws(() => h.read(), /輸入統計天數/);
  assert.equal(h.read({days: 1, includeToday: false}).rows[0].total, 5);
  assert.throws(() => h.ctx.periodSaveSettings_({days: '', includeToday: true}), /輸入統計天數/);
  assert.equal(settings.values[1][1], '');
  const saved = h.ctx.periodSaveSettings_({days: 7, includeToday: false});
  assert.equal(saved.days, 7); assert.equal(saved.includeToday, false);
  const result = h.read();
  assert.equal(result.period.start, '2026-10-27'); assert.equal(result.period.end, '2026-11-02');
  assert.equal(result.rows[0].total, 8);
});

test('selected-date status read is independent of the current statistics period and performs no writes', () => {
  const h = harness();
  h.state('訂貨統計設定').values[1][1] = '';
  const day = h.day('2026-10-20');
  assert.equal(day.date, '2026-10-20'); assert.equal(day.error, ''); assert.equal(day.complete, false);
  assert.equal(typeof day.fingerprint, 'string'); assert.equal(day.fingerprint.length, 64);
  assert.throws(() => h.day('2026-11-04'), /未來日期/);
  assert.equal(h.batches.length, 0);
});

test('completion records independently read back and retries are idempotent, including blank zero days', () => {
  const h = harness(), before = copy(h.state(source.name).values);
  for (const date of dates) h.complete(date);
  assert.equal(h.batches.length, 3);
  h.complete(dates[2]); assert.equal(h.batches.length, 3);
  const result = h.read();
  assert.equal(result.rows[0].complete, true); assert.equal(result.rows[0].total, 10);
  assert.equal(result.rows[1].complete, true); assert.equal(result.rows[1].total, 0);
  assert.equal(result.completion[source.name].every(day => day.complete), true);
  assert.equal(h.day(dates[2]).complete, true);
  h.complete('2026-10-20'); assert.equal(h.day('2026-10-20').complete, true);
  assert.deepEqual(h.state(source.name).values, before);
});

test('stale fingerprints and unconfirmed blanks reject completion before writing', () => {
  const h = harness(), snapshot = h.day(dates[2]);
  assert.throws(() => h.ctx.periodComplete_({...snapshot, actor: '隔離測試員'}), /空白代表零/);
  h.state(source.name).values[2][16] = 4;
  assert.throws(() => h.ctx.periodComplete_({...snapshot, actor: '隔離測試員', confirmBlankZero: true}), /資料已變更/);
  assert.equal(h.batches.length, 0);
  h.complete(dates[2]); assert.equal(h.day(dates[2]).complete, true);
  h.state(source.name).values[2][16] = 6;
  assert.equal(h.day(dates[2]).complete, false);
  assert.equal(h.read().completion[source.name][2].status, '待重新確認');
});

test('duplicate date columns, invalid headers, formula cells, duplicate codes, and audit mismatches are blocked', () => {
  const mutations = [
    h => { const s = h.state(source.name); s.values[0][17] = new Date('2026-11-02T16:00:00Z'); s.values[1][17] = '二'; s.values[2][17] = 2; },
    h => { h.state(source.name).values[0][16] = '11/03'; },
    h => { h.state(source.name).formulas[2] = []; h.state(source.name).formulas[2][16] = '=1+1'; },
    h => { h.state(source.name).values[3][1] = 'QA1'; },
    h => { h.event(dates[2], 9); },
    h => { h.state(source.name).values[2][16] = 0.5; }
  ];
  for (const mutate of mutations) {
    const h = harness(); mutate(h);
    assert.equal(h.read().rows[0].total, null);
    assert.ok(h.day(dates[2]).error);
    assert.throws(() => h.complete(dates[2]), /待核對/);
    assert.equal(h.batches.length, 0);
  }
});

test('loss invalidations deduplicate source/date, remain read-only until included in the caller batch', () => {
  const h = harness(); h.complete(dates[2]);
  const beforeCount = h.batches.length;
  const requests = h.ctx.periodInvalidations_(h.book, [
    {date: dates[2], sheet: source.name, code: 'QA1'}, {date: dates[2], sheet: source.name, code: 'QA2'}
  ], '隔離測試員', '2026-11-03T10:00:00Z');
  assert.equal(requests.length, 1); assert.equal(requests[0].appendCells.rows.length, 1);
  assert.equal(h.batches.length, beforeCount); assert.equal(h.day(dates[2]).complete, true);
  h.apply({requests});
  assert.equal(h.day(dates[2]).complete, false);
  assert.equal(h.state('耗損登錄狀態').values.at(-1)[2], '待重新確認');
  assert.equal(h.ctx.periodInvalidations_(h.book, [], '隔離測試員', '').length, 0);
});

test('actual cumulative commit writes daily loss, stock, audit and completion invalidation in one atomic batch', () => {
  const h = harness(); h.complete(dates[2]);
  vm.runInContext(fs.readFileSync('gas/loss/Code.gs', 'utf8'), h.ctx);
  h.ctx.loss3Actor_ = () => 'fixture@example.invalid';
  h.ctx.loss3Hash_ = h.hash;
  h.ctx.loss3RefreshPosted_ = () => {};
  const plan = {key: 'QA1-day', date: dates[2], sheet: source.name, code: 'QA1', name: '測試藥一', sheetId: 101, row: 2, col: 16, total: 4, before: 2, delta: 2, stockAfter: 48, revision: 0};
  h.ctx.loss3Read_ = () => ({ss: h.book, log: h.book.getSheetByName('耗損V3_更正紀錄'), token: 'review', plan: [plan], draft: {date: dates[2], actor: '隔離測試員'}});
  const before = h.batches.length;
  h.ctx.lossV3Commit({}, 'review');
  assert.equal(h.batches.length, before + 1);
  const batch = h.batches.at(-1);
  assert.ok(batch.some(r => r.updateCells?.start.columnIndex === 6));
  assert.ok(batch.some(r => r.updateCells?.start.columnIndex === 16));
  assert.ok(batch.some(r => r.appendCells?.sheetId === 104));
  assert.ok(batch.some(r => r.appendCells?.sheetId === 103));
  assert.equal(h.state(source.name).values[2][6], 48);
  assert.equal(h.day(dates[2]).complete, false);
  h.ctx.loss3Read_ = () => ({ss: h.book, token: 'review', plan: [], draft: {date: dates[2]}});
  h.ctx.lossV3Commit({}, 'review'); assert.equal(h.batches.length, before + 1);
});

test('lock and atomic failure preserve completion status and always release acquired locks', () => {
  const h = harness(), day = h.day(dates[2]);
  h.setLock(false);
  assert.throws(() => h.read(), /其他交易/);
  assert.throws(() => h.ctx.periodComplete_({...day, actor: '隔離測試員', confirmBlankZero: true}), /其他交易/);
  h.setLock(true); h.setReject(true);
  const released = h.released();
  assert.throws(() => h.ctx.periodComplete_({...day, actor: '隔離測試員', confirmBlankZero: true}), /atomic rejection/);
  assert.equal(h.released(), released + 1);
  assert.equal(h.state('耗損登錄狀態').values.length, 1);
  assert.equal(h.batches.length, 0);
});

test('generated period backend exactly matches the pure core and adapter sources', () => {
  const expected = 'const LossPeriod=(function(){\n' + fs.readFileSync('src/loss-period.mjs', 'utf8').replaceAll('export ', '') + '\nreturn {lossPeriod,summarizeLossPeriod};})();\n' + fs.readFileSync('gas/cloud/period-adapter.gs', 'utf8');
  assert.equal(fs.readFileSync('gas/cloud/Period.gs', 'utf8'), expected);
});
