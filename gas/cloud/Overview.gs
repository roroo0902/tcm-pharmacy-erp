function erpOverviewCatalog() {
  orderDeliveryAuth_();
  const book = SpreadsheetApp.openById(ERP.inventory);
  const config = book.getSheetByName('廠商設定');
  if (!config) return erpSupplierInventoryCatalog_();
  const [header, ...rows] = config.getDataRange().getValues();
  if (header.slice(0, 5).join('|') !== '啟用|廠商|類別|工作表ID|顯示順序') throw Error('廠商設定表頭有變動');
  const tabs = new Map(book.getSheets().map(tab => [tab.getSheetId(), tab.getName()]));
  const sources = [], registry = [], seen = new Set(), groups = new Set();
  rows.sort((a, b) => Number(a[4] || 0) - Number(b[4] || 0));
  for (const [active, vendor, kind, tabId] of rows) {
    const brand = String(vendor || '').trim(), category = String(kind || '').trim();
    const enabled = active === true || ['是','啟用','TRUE'].includes(String(active).trim());
    if (brand && category) registry.push({brand, category});
    if (!enabled) continue;
    const gid = Number(tabId), name = tabs.get(gid), group = JSON.stringify([brand,category]);
    if (String(tabId).trim() === '' || !brand || !category || !name || seen.has(gid) || groups.has(group)) throw Error('請核對已啟用的廠商、類別及工作表 ID');
    seen.add(gid); groups.add(group);
    sources.push({name, brand, category, gid});
  }
  const sheets = {};
  if (sources.length) {
    const ranges = sources.flatMap(({name}) => {
      const title = "'" + name.replace(/'/g, "''") + "'!";
      return [title+'B:B', title+'D:G', title+'K:L'];
    });
    const data = erpBatchInventoryRanges_(ranges);
    sources.forEach(({name}, i) => {
      const [codes, details, flags] = data.slice(i*3, i*3+3).map(r => r.values || []);
      sheets[name] = Array.from({length:Math.max(codes.length,details.length,flags.length)}, (_, n) => {
        const [drug='', price='', updated='', stock=''] = details[n] || [];
        return ['', codes[n]?.[0] || '', '', drug, price, updated, stock, '', '', '', ...(flags[n] || [])];
      });
      erpSupplierHeaders_(name, sheets[name]);
    });
  }
  return {sources, sheets, registry};
}
