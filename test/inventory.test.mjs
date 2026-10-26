import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryLedger } from '../src/inventory.mjs';

const make = () => {
  const ledger = new InventoryLedger({ today: () => '2026-10-26' });
  ledger.register({ id: 'P1', brand: '測試廠牌', name: '測試藥品', openingDate: '2026-10-26', openingBottles: 10 });
  return ledger;
};
const entry = (id, type, bottles, extra = {}) => ({ id, itemId: 'P1', date: '2026-10-26', type, bottles, actor: '測試人', ...extra });

test('期初10、進貨5、耗損3得到12瓶；重送不重複扣庫', () => {
  const l = make();
  l.post(entry('IN1', '進貨', 5));
  const use = entry('OUT1', '耗損', 3);
  assert.equal(l.post(use).balance, 12);
  assert.equal(l.post(use).duplicate, true);
  assert.equal(l.balance('P1'), 12);
  assert.equal(l.history('P1').length, 2);
  assert.throws(() => l.post(entry('OUT1', '耗損', 4)), /交易ID衝突/);
});

test('拒絕錯誤日期、未知藥品、無效瓶數及不足庫存，失敗不改帳', () => {
  const l = make();
  for (const e of [
    entry('X1', '耗損', 1, { date: '2026-10-25' }),
    entry('X2', '耗損', 1, { date: '2026-10-27' }),
    entry('X3', '耗損', 1, { date: '2026-02-30' }),
    entry('X4', '耗損', 1, { date: '=TODAY()' }),
    entry('X5', '耗損', 1, { itemId: 'UNKNOWN' }),
    entry('X6', '耗損', 0), entry('X7', '耗損', -1),
    entry('X8', '耗損', NaN), entry('X9', '耗損', 11),
    entry('X10', '耗損', 0.001), entry('X11', '__proto__', 1),
  ]) assert.throws(() => l.post(e));
  assert.equal(l.balance('P1'), 10);
  assert.equal(l.history('P1').length, 0);
});

test('更正保留原單、沖銷單與新單，沖銷重送只記一次', () => {
  const l = make();
  l.post(entry('USE1', '耗損', 3));
  const fix = { id: 'REV1', date: '2026-10-26', actor: '主管', reason: '原填3瓶，應為2瓶' };
  assert.equal(l.reverse('USE1', fix).balance, 10);
  assert.equal(l.reverse('USE1', fix).duplicate, true);
  l.post(entry('USE2', '耗損', 2, { note: '更正USE1' }));
  assert.equal(l.balance('P1'), 8);
  assert.equal(l.history('P1').length, 3);
  assert.throws(() => l.reverse('USE1', { ...fix, id: 'REV2' }), /已沖銷/);
});

test('不同廠牌分開計算；小數瓶數不產生浮點誤差', () => {
  const l = make();
  l.register({ id: 'P2', brand: '另一廠牌', name: '測試藥品', openingDate: '2026-10-26', openingBottles: 0.3 });
  l.post(entry('SMALL1', '耗損', 0.1, { itemId: 'P2' }));
  l.post(entry('SMALL2', '耗損', 0.2, { itemId: 'P2' }));
  assert.equal(l.balance('P2'), 0);
  assert.equal(l.balance('P1'), 10);
});

test('進貨已被耗用後，沖銷不能產生負庫存', () => {
  const l = make();
  l.post(entry('IN1', '進貨', 5));
  l.post(entry('USE1', '耗損', 14));
  assert.throws(() => l.reverse('IN1', { id: 'REV1', date: '2026-10-26', actor: '主管', reason: '錯誤進貨' }), /庫存不足/);
  assert.equal(l.balance('P1'), 1);
  assert.equal(l.history('P1').length, 2);
});
