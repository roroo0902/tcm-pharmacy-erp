import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { planLoss, lossNumber } from '../src/loss.mjs';

function fixture() {
  const grid = () => Array.from({length: 3}, () => Array(16).fill(''));
  const s = grid(), i = grid();
  s[0][1] = i[0][1] = '編號'; s[0][2] = i[0][3] = '藥品名稱';
  i[1][6] = '未拆封'; i[1][5] = '時間'; i[1][13] = '一';
  s[2] = ['', 'A083', '陳皮', 1, 2, '']; i[2][1] = 'A083'; i[2][3] = '陳皮'; i[2][6] = 10;
  i[2][13] = 4;
  return { sourceId: 'source', executedDate: '2026-10-28', ledger: [], sheets: [{name:'科達單方',
    source: {id: 1, values:s, notes:grid(), formulas:grid(), dates: Array(3).fill('2026-10-28')},
    inventory: {id: 2, values:i, formulas:grid(), dates:Array(16).fill(null).map((_, n) => n === 13 ? '2026-10-28' : null)} }] };
}
test('D/E are separate additional amounts, aggregate G and daily column once; never C/L/M', () => {
  const p = planLoss(fixture());
  assert.equal(p.entries.length, 2);
  assert.equal(p.updates.find(u => u.col === 6).value, 7);
  assert.equal(p.updates.find(u => u.col === 13).value, 7);
  assert.deepEqual(p.updates.map(u => u.col), [6, 5, 13]);
});
test('ledger protects retry even if source notes were never written; a new E/F slot still posts', () => {
  const s = fixture(), first = planLoss(s); s.ledger = first.entries;
  assert.equal(planLoss(s).entries.length, 0);
  s.sheets[0].source.values[2][5] = 1;
  assert.equal(planLoss(s).entries.length, 1);
});
test('same code transaction survives source row reordering', () => {
  const s = fixture(); s.ledger = planLoss(s).entries;
  const source = s.sheets[0].source;
  source.values.push(source.values[2]); source.values[2] = Array(6).fill('');
  source.notes.push(Array(6).fill(''));
  assert.equal(planLoss(s).entries.length, 0);
});
test('posted quantity edits and clearing are rejected rather than silently reapplied', () => {
  for (const value of [3, 0, '']) {
    const s = fixture(); s.ledger = planLoss(s).entries;
    s.sheets[0].source.values[2][3] = value;
    assert.throws(() => planLoss(s), /已入帳/);
  }
});
test('unsafe numbers and blank stock fail closed', () => {
  for (const n of [-1, Infinity, NaN, 'abc', true, ' ', '1e3']) assert.throws(() => lossNumber(n, '數量'));
  const s = fixture(); s.sheets[0].inventory.values[2][6] = '';
  assert.throws(() => planLoss(s), /未填/);
});
test('decimal bottle arithmetic does not reject 0.1 + 0.2 against 0.3 stock', () => {
  const s = fixture(); s.sheets[0].source.values[2][3] = 0.1; s.sheets[0].source.values[2][4] = 0.2;
  s.sheets[0].inventory.values[2][6] = 0.3;
  assert.equal(planLoss(s).updates.find(u => u.col === 6).value, 0);
});
test('validation rejects name mismatch, duplicate codes, formulas, negative stock and legacy notes', () => {
  const mutations = [
    s => s.sheets[0].inventory.values[2][3] = '別的藥',
    s => s.sheets[0].inventory.values.push(s.sheets[0].inventory.values[2]),
    s => s.sheets[0].source.values.push(s.sheets[0].source.values[2]),
    s => s.sheets[0].inventory.formulas[2][6] = '=1',
    s => s.sheets[0].inventory.values[2][6] = 2,
    s => s.sheets[0].source.notes[2][3] = '已扣庫存',
    s => s.sheets[0].source.formulas[0][3] = '=TODAY()',
    s => s.sheets[0].inventory.values[0][3] = 'changed'
  ];
  for (const mutate of mutations) {const s = fixture(); mutate(s); assert.throws(() => planLoss(s));}
});
test('missing, duplicate, cross-year or aggregate date columns never deduct G', () => {
  for (const mutate of [
    s => s.sheets[0].inventory.dates[13] = '2025-10-28',
    s => {s.sheets[0].inventory.dates[14] = '2026-10-28'; s.sheets[0].inventory.values[1][14] = '二';},
    s => s.sheets[0].inventory.values[1][13] = '耗損量'
  ]) {const s = fixture(); mutate(s); assert.throws(() => planLoss(s), /唯一完整日期/);}
});

function gasContext() {
  const c = vm.createContext({ console, Utilities: { DigestAlgorithm: {SHA_256: 'sha256'},
    computeDigest: (_, v) => [...createHash('sha256').update(v).digest()] }});
  vm.runInContext(fs.readFileSync('gas/loss/legacy/Code-v2.gs', 'utf8'), c);
  return c;
}
test('one atomic target batch contains stock, daily sum, ledger and unique retry guards', () => {
  const c = gasContext(), p = planLoss(fixture());
  const requests = c.lossRequests_({log:null}, p, 'tester@example.test', 'now');
  assert.equal(requests.filter(r => r.appendCells).length, 1);
  assert.equal(requests.filter(r => r.addNamedRange).length, 2);
  const ids = requests.filter(r => r.addNamedRange).map(r => r.addNamedRange.namedRange.namedRangeId);
  assert.equal(new Set(ids).size, 2);
  assert.deepEqual(Array.from(c.lossRequests_({log:null}, p, 'tester@example.test', 'later').filter(r => r.addNamedRange).map(r => r.addNamedRange.namedRange.namedRangeId)), Array.from(ids));
  assert.equal(c.lossRequests_({log:null}, {entries:[]}, '', '').length, 0);
});
test('fixed date parser rejects incomplete years and invalid dates', () => {
  const c = gasContext();
  assert.equal(c.lossDate_('2026/10/28', 'Asia/Taipei'), '2026-10-28');
  for (const v of ['10/28', '2026/02/30', '2026/13/1', '']) assert.equal(c.lossDate_(v, 'Asia/Taipei'), null);
});
test('execution checks token and lock before any write, always unlocks after failure', () => {
  const c = gasContext(); let unlocked = 0, writes = 0;
  c.LockService = {getScriptLock: () => ({tryLock: () => true, releaseLock: () => unlocked++})};
  c.Sheets = {Spreadsheets: {batchUpdate: () => writes++}};
  c.lossRead_ = () => ({snapshot: fixture()}); c.lossToken_ = () => 'fresh';
  assert.throws(() => c.syncLossToInventory(), /先預覽/);
  assert.throws(() => c.syncLossToInventory('old'), /資料已變動/);
  assert.equal(writes, 0); assert.equal(unlocked, 1);
  c.LockService = {getScriptLock: () => ({tryLock: () => false})};
  assert.throws(() => c.syncLossToInventory('fresh'), /另一筆/);
});
test('generated GAS is reproducible and the dialog script parses', () => {
  const expected = '// Generated by scripts/build-loss-gas.mjs; edit src/loss.mjs and gas/loss/adapter.gs.\n' +
    'const LossEngine = (function () {\n' + fs.readFileSync('src/loss.mjs','utf8').replaceAll('export function ', 'function ') +
    '\nreturn {planLoss};\n})();\n' + fs.readFileSync('gas/loss/adapter.gs','utf8');
  assert.equal(fs.readFileSync('gas/loss/legacy/Code-v2.gs','utf8'), expected);
  const c = gasContext(); let html;
  c.lossV2ReadOnlyCheck = () => ({count:1,bottles:1,alreadyPosted:0,token:'x',lines:['</script>']});
  c.HtmlService = {createHtmlOutput: text => {html = text; return {setWidth(){return this;},setHeight(){return this;}};}};
  c.SpreadsheetApp = {getUi: () => ({showModalDialog(){}})};
  c.openCuteConfirmDialog();
  assert.equal((html.match(/<\/script>/g)||[]).length, 1);
  new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
});
test('lost API response after commit is recovered from ledger without a second stock write', () => {
  const c = gasContext(), snapshot = fixture(); let calls = 0;
  c.LockService = {getScriptLock: () => ({tryLock: () => true, releaseLock(){}})};
  c.Session = {getActiveUser: () => ({getEmail: () => 'tester@example.test'})};
  c.lossRead_ = () => ({snapshot, log:null, source:{getSheets: () => []}});
  c.lossToken_ = () => 'current';
  c.Sheets = {Spreadsheets: {batchUpdate: ({requests}) => {
    calls++;
    snapshot.ledger = requests.find(r => r.appendCells).appendCells.rows.map(r => JSON.parse(r.values[1].userEnteredValue.stringValue));
    throw new Error('timeout after commit');
  }}};
  assert.throws(() => c.syncLossToInventory('current'), /timeout after commit/);
  const retry = c.syncLossToInventory('current');
  assert.equal(retry.count, 0); assert.equal(calls, 1);
  assert.match(retry.warning, /註記未更新/);
});
test('target batch failure cannot write source notes or report success', () => {
  const c = gasContext(); let notes = 0;
  c.LockService = {getScriptLock: () => ({tryLock: () => true, releaseLock(){}})};
  c.Session = {getActiveUser: () => ({getEmail: () => 'tester@example.test'})};
  c.lossRead_ = () => ({snapshot:fixture(), log:null, source:{getSheets: () => {notes++; return [];}}});
  c.lossToken_ = () => 'current';
  c.Sheets = {Spreadsheets: {batchUpdate: () => {throw new Error('batch rejected');}}};
  assert.throws(() => c.syncLossToInventory('current'), /batch rejected/);
  assert.equal(notes, 0);
});
