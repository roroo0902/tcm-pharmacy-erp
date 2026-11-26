// Memory belongs to this page. Only successful reads can be reused.
export function createReadCache(ttlMs, now = Date.now, timeoutMs = 60000) {
 let current;
 function read(fetchValue, {fresh = false} = {}) {
  if (current?.pending) return current.pending;
  if (!fresh && current && now() < current.expires) return Promise.resolve(current.value);

  const entry = {};
  current = entry;
  let timer;
  const timeout = new Promise((_, reject) => {
   timer = setTimeout(() => reject(Error('讀取逾時，請重新讀取')), timeoutMs);
  });
  entry.pending = Promise.race([Promise.resolve().then(fetchValue),timeout]).then(value => {
   if (current !== entry) return read(fetchValue);
   entry.value = value;
   entry.expires = now() + ttlMs;
   entry.pending = null;
   return value;
  }, error => {
   if (current === entry) current = undefined;
   throw error;
  }).finally(() => clearTimeout(timer));
  return entry.pending;
 }
 return {read, clear: () => { current = undefined; }};
}

// Import this singleton through the same URL even when route modules are versioned.
export const supplierCache = createReadCache(60000);
