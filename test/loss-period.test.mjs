import test from 'node:test';
import assert from 'node:assert/strict';
import {lossPeriod, summarizeLossPeriod} from '../src/loss-period.mjs';

test('3, 5 and 7 day presets include today; 7 days excluding today ends yesterday', () => {
  const expected = [[3, true, '2026-11-01', '2026-11-03'], [5, true, '2026-10-30', '2026-11-03'], [7, true, '2026-10-28', '2026-11-03'], [7, false, '2026-10-27', '2026-11-02']];
  for (const [days, includeToday, start, end] of expected) {
    const result = lossPeriod({days, includeToday}, '2026-11-03');
    assert.equal(result.start, start);
    assert.equal(result.end, end);
    assert.equal(result.dates.length, days);
    assert.equal(new Set(result.dates).size, days);
    assert.equal(result.label, `近 ${days} 天耗損量`);
  }
});

test('custom numeric string, single day and maximum range are accepted', () => {
  assert.deepEqual(lossPeriod({days: ' 1 ', includeToday: false}, '2026-11-03').dates, ['2026-11-02']);
  assert.equal(lossPeriod({days: 3660, includeToday: true}, '2026-11-03').dates.length, 3660);
});

test('blank and invalid days are never silently interpreted as zero or a default', () => {
  for (const days of ['', ' ', null, undefined, true, [], {}, 0, -1, 1.5, 'abc', Infinity, NaN, 3661]) {
    assert.throws(() => lossPeriod({days, includeToday: true}, '2026-11-03'), /天數/);
  }
  for (const includeToday of ['', 'true', 1, null, undefined]) assert.throws(() => lossPeriod({days: 3, includeToday}, '2026-11-03'), /包含今天/);
});

test('calendar arithmetic handles leap days and year boundaries without local timezone shifts', () => {
  assert.deepEqual(lossPeriod({days: 3, includeToday: true}, '2028-03-01').dates, ['2028-02-28', '2028-02-29', '2028-03-01']);
  assert.deepEqual(lossPeriod({days: 3, includeToday: true}, '2027-01-01').dates, ['2026-12-30', '2026-12-31', '2027-01-01']);
  assert.deepEqual(lossPeriod({days: 2, includeToday: true}, '2027-03-01').dates, ['2027-02-28', '2027-03-01']);
  for (const date of ['2026-02-29', '2026-13-01', '2026-1-01', '11/03', '2026-11-03T00:00:00Z', '', null]) assert.throws(() => lossPeriod({days: 3, includeToday: true}, date), /日期/);
});

const dates = ['2026-11-01', '2026-11-02', '2026-11-03'];
const row = values => ({sheet: '測試單方', code: 'QA1', name: '測試藥品', values});

test('sum final daily cumulative values once, ignoring dates outside the requested period', () => {
  const result = summarizeLossPeriod({dates, completedDates: dates, rows: [row({'2026-10-31': 100, '2026-11-01': 3, '2026-11-02': 5, '2026-11-03': 2})]})[0];
  assert.equal(result.total, 10);
  assert.equal(result.complete, true);
  assert.deepEqual(result.missingDates, []);
});

test('uncompleted days retain the registered partial sum and do not claim zero completeness', () => {
  const result = summarizeLossPeriod({dates, completedDates: [dates[0]], rows: [row({[dates[0]]: 3, [dates[1]]: 5, [dates[2]]: null})]})[0];
  assert.equal(result.total, 8);
  assert.equal(result.complete, false);
  assert.deepEqual(result.missingDates, dates.slice(1));
  const empty = summarizeLossPeriod({dates, rows: [row({})]})[0];
  assert.equal(empty.total, 0);
  assert.equal(empty.complete, false);
  assert.deepEqual(empty.missingDates, dates);
});

test('completed days treat blank values as confirmed zero and preserve explicit zero', () => {
  const result = summarizeLossPeriod({dates, completedDates: dates, rows: [row({[dates[0]]: 0, [dates[1]]: null})]})[0];
  assert.equal(result.total, 0);
  assert.equal(result.complete, true);
  assert.deepEqual(result.missingDates, []);
});

test('invalid numeric totals and source errors never become a misleading partial result', () => {
  for (const value of [-1, 1.5, '2', '', Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const result = summarizeLossPeriod({dates, completedDates: dates, rows: [row({[dates[0]]: 3, [dates[1]]: value})]})[0];
    assert.equal(result.total, null);
    assert.equal(result.complete, false);
    assert.match(result.error, /每日耗損/);
  }
  const result = summarizeLossPeriod({dates, completedDates: dates, rows: [{...row({[dates[0]]: 4}), errors: {[dates[1]]: '日期欄重複'}}]})[0];
  assert.equal(result.total, null);
  assert.match(result.error, /日期欄重複/);
});

test('aggregation rejects duplicate days and protects safe integer sums', () => {
  assert.throws(() => summarizeLossPeriod({dates: [dates[0], dates[0]], rows: []}), /重複/);
  assert.throws(() => summarizeLossPeriod({dates: [], rows: []}), /空白/);
  const result = summarizeLossPeriod({dates, rows: [row({[dates[0]]: Number.MAX_SAFE_INTEGER, [dates[1]]: 1})]})[0];
  assert.equal(result.total, null);
  assert.match(result.error, /超出/);
});

test('aggregation leaves source rows, values and completion dates unchanged', () => {
  const values = Object.freeze({[dates[0]]: 2}), sourceRow = Object.freeze(row(values));
  const input = Object.freeze({dates: Object.freeze([...dates]), completedDates: Object.freeze([dates[0]]), rows: Object.freeze([sourceRow])});
  const result = summarizeLossPeriod(input)[0];
  assert.notEqual(result, sourceRow);
  assert.equal(sourceRow.total, undefined);
  assert.deepEqual(values, {[dates[0]]: 2});
  result.missingDates.push('2026-11-04');
  assert.equal(input.dates.length, 3);
});
