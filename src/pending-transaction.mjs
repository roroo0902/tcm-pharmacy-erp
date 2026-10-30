// Reconcile an interrupted cancellation with the cancellation actually on record.
export function findPostedTransaction(rows, draft) {
  const exact = rows.find(row => row[0] === draft.id);
  if (exact) return exact;
  if (draft.action !== '取消訂貨' || !draft.reverses) return null;
  return rows.find(row => {
    if (row[3] !== '取消訂貨' || row[7] !== '已取消・未發送') return false;
    try {
      const posted = JSON.parse(row[1]).draft;
      return posted.action === '取消訂貨' && posted.reverses === draft.reverses;
    } catch { return false; }
  }) || null;
}
