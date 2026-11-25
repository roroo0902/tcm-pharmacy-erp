export const registrationKey = 'tcm-registration-pending-v1';

export function preserveLegacyRegistration(storage) {
  const sharedKey = 'tcm-cloud-pending-v1';
  const raw = storage.getItem(sharedKey);
  if (!raw) return;
  let prior;
  try { prior = JSON.parse(raw); } catch { return; }
  if (prior?.action !== '建檔' || !prior.id) return;
  const existing = storage.getItem(registrationKey);
  if (existing && existing !== raw) return;
  storage.setItem(registrationKey, raw);
  if (storage.getItem(sharedKey) === raw) storage.removeItem(sharedKey);
}
