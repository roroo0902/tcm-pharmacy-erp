const reasons = ['重複訂貨', '訂錯廠商', '訂錯品項', '訂貨數量有誤', '庫存足夠，暫不訂購', '廠商缺貨，無法供貨'];

// The shared transaction format requires an actor even when nobody is selected.
export const unspecifiedCancelActor = '未指定';

export function orderCancelFields() {
  return `<form data-order-cancel-form>
    <label>取消原因<select name="reason" required>
      <option value="">請選擇取消原因</option>
      ${reasons.map(reason => `<option>${reason}</option>`).join('')}
      <option value="other">其他原因（自行填寫）</option>
    </select></label>
    <div hidden><label>請填寫其他原因<input name="customReason" required disabled maxlength="500" pattern=".*\\S.*"></label></div>
  </form>`;
}

export function bindOrderCancelReason() {
  const form = document.querySelector('#confirm form[data-order-cancel-form]');
  const { reason, customReason } = form.elements;
  reason.onchange = () => {
    const custom = reason.value === 'other';
    customReason.disabled = !custom;
    customReason.closest('div').hidden = !custom;
    if (custom) customReason.focus();
  };
  return () => reason.value === 'other' ? customReason.value.trim() : reason.value;
}
