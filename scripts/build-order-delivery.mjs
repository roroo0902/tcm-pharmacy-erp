import {readFile,writeFile} from 'node:fs/promises';
const source=(await readFile('src/order-pdf.mjs','utf8')).replaceAll('export function ','function ').replaceAll('orderPdfName(','orderPdfName_(').replaceAll('orderPdfHtml(','orderPdfHtml_(').replaceAll('orderMailRoster(','orderMailRoster_(');
await writeFile('gas/cloud/OrderDelivery.gs',source+'\n'+await readFile('gas/cloud/order-delivery-adapter.gs','utf8'));
