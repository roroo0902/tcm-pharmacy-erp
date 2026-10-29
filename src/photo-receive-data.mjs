// Pure helpers: OCR suggestions never write inventory and never resolve fuzzy matches automatically.
export const normalizeDrug = value => String(value ?? '').normalize('NFKC').toUpperCase().replace(/[\s\-—_()（）\[\]【】.,，。:：/／]+/g, '');

export function matchRecognized(line, candidates) {
  const code = normalizeDrug(line.code), name = normalizeDrug(line.name);
  const valid = candidates.filter(row => row.code && row.drug);
  const byCode = code ? valid.filter(row => normalizeDrug(row.code) === code) : [];
  if (byCode.length === 1) {
    const nameDiffers = !!name && normalizeDrug(byCode[0].drug) !== name;
    return {row: byCode[0], reason: nameDiffers ? '編號符合，但照片藥名不同，請仔細核對' : '編號完全相符', warning: nameDiffers};
  }
  if (byCode.length > 1) return {row: null, reason: '庫存編號重複，禁止自動比對', warning: true};
  const byName = name ? valid.filter(row => normalizeDrug(row.drug) === name) : [];
  if (byName.length === 1) return {row: byName[0], reason: '藥名完全相符，請再核對編號', warning: !!code};
  return {row: null, reason: byName.length > 1 ? '同名品項不只一筆' : '未找到完全相符品項，請手動選擇', warning: true};
}

export function cleanRecognized(payload) {
  const lines = payload?.lines;
  if (!Array.isArray(lines) || lines.length > 100) throw Error('AI 回傳的品項格式異常');
  return lines.map((line, index) => ({
    id: String(index),
    name: String(line?.name ?? '').slice(0, 120).trim(),
    code: String(line?.code ?? '').slice(0, 60).trim(),
    quantity: Number.isInteger(Number(line?.quantity)) && Number(line.quantity) > 0 ? String(line.quantity) : '',
    unit: String(line?.unit ?? '').slice(0, 20).trim(),
    evidence: String(line?.evidence ?? '').slice(0, 150).trim(),
    confidence: ['high', 'medium', 'low'].includes(line?.confidence) ? line.confidence : 'low',
    selected: '', reviewed: false, removed: false
  }));
}

export function addToBasket(basket, pendingLines, candidates, sheet) {
  const next = basket.map(x => ({...x}));
  const lookup = new Map(candidates.map(r => [String(r.id), r]));
  if (!pendingLines.length) throw Error('沒有待加入品項');
  for (const line of pendingLines) {
    if (line.removed) continue;
    const r = lookup.get(line.selected);
    if (!r) throw Error('請為所有保留品項選擇既有庫存藥名');
    if (!line.reviewed) throw Error('每項都必須由人員勾選「已核對」');
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000000) throw Error('入庫瓶數必須為 1～1,000,000 的整數');
    if (!Number.isInteger(r.bottles) || r.bottles < 0) throw Error(r.drug + '：現有庫存待核對');
    if (!r.code || r.warning?.includes('編號')) throw Error(r.drug + '：庫存編號待核對');
    const key = sheet + '|' + r.code;
    const prior = next.find(x => x.key === key);
    if (prior) {
      if (prior.quantity + qty > 1000000) throw Error(r.drug + '：同批進貨合計過大');
      prior.quantity += qty;
    } else next.push({key, sheet, code: r.code, name: r.drug, quantity: qty});
  }
  if (!next.length) throw Error('沒有可加入的進貨品項');
  if (next.length > 100) throw Error('每次最多 100 個不同品項');
  return next;
}