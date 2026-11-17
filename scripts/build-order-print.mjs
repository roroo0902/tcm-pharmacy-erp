import {readFile,writeFile} from 'node:fs/promises';
const source=(await readFile('src/order-print.mjs','utf8')).replace("import {cloudDraft} from './cloud-transaction.mjs';",'').replace('export function confirmedPrintPlan','function confirmedPrintPlan_').replace('cloudDraft(matches[0].draft)','CloudTransaction.cloudDraft(matches[0].draft)');
await writeFile('gas/cloud/OrderPrint.gs',source+'\n'+await readFile('gas/cloud/order-print-adapter.gs','utf8'));
