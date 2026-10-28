// The old WebApp auto-posted on page load. Use the bound Sheet's preview instead.
function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><h2>每日耗損 V2</h2>' +
    '<p>請開啟耗損表，使用「💊 庫存管理系統 → 預覽每日耗損並同步」，核對後確認扣庫。</p>' +
    '<a target="_top" href="https://docs.google.com/spreadsheets/d/1zQr0awr9wJr2Fbsk2PQgiMd1C640AokVmT2pPU9-fU4/edit">開啟耗損表</a>')
    .setTitle('每日耗損 V2');
}
