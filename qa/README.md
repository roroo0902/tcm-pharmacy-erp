# 瑞恩藥庫：離線合成瀏覽器驗收

Only use an immutable QA commit. This is not a deployment and never connects the page to Google, a real sheet, Gmail or a vendor. The server binds to 127.0.0.1 only and expires after 15 minutes. Closing it or reloading the browser resets the fixture. No files or real records are modified.

Requires Node.js 22 or newer. In a clean QA checkout, run:

    node qa/serve.mjs --verify
    node qa/serve.mjs

The server prints its ephemeral origin, Git commit, bundle SHA-256 and served asset sizes. Verify the hash and open that loopback origin in an isolated browser tab.

If an exact SHA is available and there is no checkout, run the reviewed runner source from that immutable commit held in memory:

    node --input-type=module -e "$runner" -- --ref "$sha" --bundle-sha256 "$expected"

To avoid a fetch on the host, add --assets-stdin and feed a JSON object with base64 values for index.html, web/hosted-app.js, qa/fixture.js, web/style.css, web/quest-theme.css, web/mobile.css and web/period-rpg-loading.js. Verify each transferred path against the immutable repository blob and the compiled bundle against the printed SHA-256. Only starting the server uses GitHub; the page has no external connect/form/frame permission and blocks external link clicks.

## Real browser checks

1. Open /#orderPlanning. Set both dates to 2026-01-19 and shipping to 0; press 讀取來源並計算耗損. The exact QA item is marked excluded. Type 3 for the normal item. Select 訂藥：下次讀取失敗 in the fixture controls, then press the app's reload. Verify old values are marked, hand entry stays at 3, and apply/confirm are disabled. Restore and reload; apply after success, QA stays blank and normal still shows 3.
2. Open /#shortage. On first load expect no fake zero; on successful empty read expect 0. Toggle fixture failure and use 重新讀取: expect 待讀取 and then 無法取得. Select 成功 34 項 and retry; verify 34 and 已訂 6 · 到貨 2 · 待到 4. On the exact QA row, 加入訂貨草稿 must show the exclusion message, not navigate.
3. Open /#shortage fresh, select 單筆待到 4 and use 重新讀取. Click 登錄實際到貨 on the QA row. Reference 4 must be visible and actual blank disables preview. Enter 1 and select QA 操作員, then preview; actual 1/link 1. Change to 2 and press 重新核對數量; preview 2/link 2, no commit yet. A second confirmation in this fixture only raises simulated stock 4→6 and updates the fixture's local commit counter.
4. Open /#loss fresh. The initial row is blank and shows posted 2. Blank submit does not preview; 0 without reason is blocked. Enter a synthetic correction note and preview 0, delta −2. Confirm only in this fixture to see simulated stock 4→6 and posted 2→0 after readback. Do not perform either confirmation on a non-loopback origin.
