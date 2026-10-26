/** Development-only in-memory ledger. Production writes need database transactions. */
export const MOVEMENT_SIGNS = Object.freeze({
  '進貨': 1, '耗損': -1, '退貨入庫': 1, '退貨出庫': -1, '盤盈': 1, '盤虧': -1,
});

const units = (n) => Math.round(n * 100);
function bottles(value, zero = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      (zero ? value < 0 : value <= 0) || !Number.isSafeInteger(units(value)) ||
      Math.abs(value * 100 - units(value)) > 1e-7) {
    throw new Error('瓶數必須為有效數值，最多兩位小數');
  }
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error(`${label}必填且不得含首尾空白`);
  }
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('請輸入固定日期 YYYY-MM-DD');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('日期不存在');
  }
}

export class InventoryLedger {
  #items = new Map();
  #entries = new Map();
  #reversed = new Set();
  #clock;
  constructor({ today } = {}) {
    this.#clock = today ?? (() => new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()));
  }

  register(item) {
    text(item.id, '庫存ID');
    text(item.name, '藥名');
    text(item.brand, '廠牌');
    date(item.openingDate);
    bottles(item.openingBottles, true);
    if (item.openingDate > this.#clock()) throw new Error('期初日不能是未來日期');
    if (this.#items.has(item.id)) throw new Error('庫存ID已存在');
    this.#items.set(item.id, Object.freeze({ ...item }));
  }

  post(entry) {
    text(entry.id, '交易ID');
    text(entry.itemId, '庫存ID');
    text(entry.actor, '經手人');
    date(entry.date);
    bottles(entry.bottles);
    const item = this.#items.get(entry.itemId);
    if (!item) throw new Error('藥品尚未建帳');
    if (!Object.hasOwn(MOVEMENT_SIGNS, entry.type)) throw new Error('交易類型錯誤');
    if (entry.date < item.openingDate || entry.date > this.#clock()) {
      throw new Error('交易日期早於期初或晚於今天');
    }
    const normalized = Object.freeze({
      id: entry.id, itemId: entry.itemId, date: entry.date,
      type: entry.type, bottles: entry.bottles, actor: entry.actor,
      note: String(entry.note ?? ''),
    });
    const previous = this.#entries.get(entry.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(normalized)) throw new Error('交易ID衝突');
      return { duplicate: true, balance: this.balance(entry.itemId) };
    }
    const signedUnits = units(entry.bottles) * MOVEMENT_SIGNS[entry.type];
    if (units(this.balance(entry.itemId)) + signedUnits < 0) throw new Error('庫存不足');
    this.#entries.set(entry.id, normalized);
    return { duplicate: false, balance: this.balance(entry.itemId) };
  }

  reverse(originalId, { id, date: onDate, actor, reason }) {
    const original = this.#entries.get(originalId);
    if (!original || original.reverses) throw new Error('原交易不存在或為沖銷單');
    text(id, '沖銷交易ID');
    text(actor, '經手人');
    text(reason, '更正原因');
    date(onDate);
    const reversal = Object.freeze({
      id, itemId: original.itemId, date: onDate, type: '沖銷',
      bottles: original.bottles, actor, note: reason, reverses: originalId,
    });
    const previous = this.#entries.get(id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(reversal)) throw new Error('交易ID衝突');
      return { duplicate: true, balance: this.balance(original.itemId) };
    }
    if (this.#reversed.has(originalId)) throw new Error('原交易已沖銷');
    if (onDate < original.date || onDate > this.#clock()) throw new Error('沖銷日期錯誤');
    if (units(this.balance(original.itemId)) - this.#delta(original) < 0) throw new Error('沖銷後庫存不足');
    this.#entries.set(id, reversal);
    this.#reversed.add(originalId);
    return { duplicate: false, balance: this.balance(original.itemId) };
  }

  #delta(entry) {
    if (entry.reverses) return -this.#delta(this.#entries.get(entry.reverses));
    return units(entry.bottles) * MOVEMENT_SIGNS[entry.type];
  }

  balance(itemId) {
    const item = this.#items.get(itemId);
    if (!item) throw new Error('藥品尚未建帳');
    let total = units(item.openingBottles);
    for (const entry of this.#entries.values()) {
      if (entry.itemId === itemId) total += this.#delta(entry);
    }
    if (!Number.isSafeInteger(total)) throw new Error('庫存超過安全計算範圍');
    return total / 100;
  }

  history(itemId) {
    return [...this.#entries.values()].filter(e => e.itemId === itemId).map(e => ({ ...e }));
  }
}
