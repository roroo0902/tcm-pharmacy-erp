// The same inputs stay mounted when the layout changes between table and cards.
export const lossLayout = `<style>
.loss-workbench { color:var(--quest-ink) }
.loss-panelhead,.loss-tools { display:flex;align-items:center;justify-content:space-between;gap:12px }
.loss-panelhead h2#loss-heading {
 display:inline-flex;align-items:center;gap:10px;margin:0;padding:5px 14px 5px 9px;
 border:4px double #dcba67;border-radius:6px;background:#18344c;color:#fff6dc;line-height:1.25;
 clip-path:polygon(5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px),0 5px);
}
#loss-heading::before { content:none }
#loss-heading img { object-fit:contain;flex:none;image-rendering:pixelated }
.loss-panelhead > a { white-space:nowrap }
.loss-workbench .loss-subheading { color:var(--quest-ink);font-size:1.15rem;margin:15px 0 8px }
#loss-qty-help { margin:0 0 16px;padding:9px 12px;border:1px solid #bdced1;border-left:4px solid #537184;border-radius:4px;background:#ecf2f1;line-height:1.5 }
.loss-selectors,.loss-fields { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px;margin:14px 0 }
.loss-selector { display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;min-width:0 }
.loss-selector > span,.loss-fields label { color:var(--quest-ink);font-size:.925rem;font-weight:600 }
.loss-selector .order-tabs { margin:0;gap:6px }
.loss-fields label { margin:0;min-width:0 }
.loss-fields label > :is(input,select,textarea) { display:block;width:100%;margin:5px 0 0 }
.loss-fields .loss-full { grid-column:1/-1 }
.loss-fields [hidden],.loss-fields .staff-controls[hidden] { display:none }
.loss-tools { margin:16px 0 12px }
.loss-tools input { max-width:30rem;width:100%;min-width:0;margin:0 }
.loss-tools button { flex:none }
@media(min-width:761px) {
 .loss-tools #loss-refresh { order:2 }
 .loss-tools .refresh-status { margin-inline-start:auto;text-align:end }
}
.loss-workbench #loss-state { margin:10px 0 12px }
.loss-price-note { margin:7px 0 12px;font-size:.875rem;color:#526579 }
#content .loss-items { max-width:100%;overflow:auto }
#content #loss-table { width:100%;white-space:normal;font-variant-numeric:tabular-nums }
#content #loss-table :is(td,th) { min-width:0;text-align:center;vertical-align:middle }
#content #loss-table thead th { padding:8px;font-size:.875rem;font-weight:600 }
#content #loss-table .sort-heading { font-size:inherit;font-weight:inherit;white-space:nowrap }
#content #loss-table tbody td { padding:13px 8px;font-size:.925rem;line-height:1.5 }
#content #loss-table .loss-product:not([colspan]) { text-align:start;min-width:8.5rem;background:none;padding-inline-start:14px }
#content #loss-table tbody td.loss-product::before { content:none!important;display:none!important }
#content #loss-table tbody td.loss-product { background-image:none!important }
.loss-item-name { display:flex;align-items:baseline;gap:4px 8px;flex-wrap:wrap }
.loss-item-name b { font-size:1rem;overflow-wrap:anywhere }
.loss-code { font-size:.8rem;border-radius:4px;border:1px solid #d9c9a8;background:#f5eddd;padding:0 5px;color:#3e5263;overflow-wrap:anywhere }
.loss-product small { display:block;color:#53687a;font-size:.8rem }
#content #loss-table .loss-price { width:6rem;min-width:0;margin:0;text-align:end;font-size:1rem;padding:6px }
#content #loss-table .loss-price[aria-invalid="true"] { border-color:#a43f31 }
.loss-price-error:not([hidden]) { display:block;max-width:14rem;margin:3px auto;color:#973727;font-size:.8rem;white-space:normal }
#content #loss-table .loss-entry-cell { min-width:10.5rem }
#content #loss-table td.loss-source { min-width:3.75rem }
#content #loss-table .quantity-stepper { display:grid;position:static;grid-template-columns:28px 68px 28px 14px!important;gap:4px!important;width:max-content!important;max-width:100%;margin-inline:auto!important }
#content #loss-table .quantity-stepper .quantity-adjust { width:28px;min-width:28px;height:34px;min-height:34px;padding:0;border-radius:5px;font-size:18px }
#content #loss-table .quantity-stepper input { height:34px;min-height:34px;padding:4px;font-size:.92rem;font-weight:500 }
#content #loss-table .quantity-stepper .quantity-unit { position:static;grid-column:4;grid-row:1;height:auto;align-self:center }
#content #loss-table .quantity-stepper .quantity-clear { position:static;grid-column:2!important;grid-row:2!important;justify-self:center!important;min-height:20px;height:auto;width:auto!important;padding:2px 6px;font-size:.78rem;line-height:1.2 }

@media (max-width:760px) {
 .loss-selectors { grid-template-columns:minmax(0,1fr);gap:10px }
 .loss-tools { flex-wrap:wrap }
 .loss-tools input { flex:1 1 12rem }
 .loss-panelhead { align-items:flex-start }
 #content .loss-workbench .loss-items { overflow:visible;border:0;border-radius:0 }
 #content #loss-table,#content #loss-table :is(thead,tbody) { display:block;min-width:0 }
 #content #loss-table thead tr { display:flex;flex-wrap:wrap;gap:4px }
 #content #loss-table thead th { padding:0;background:transparent;border:0 }
 #content #loss-table thead th:not(:has(button)) { display:none }
 #content #loss-table .sort-heading { width:auto;min-height:44px;padding:5px 8px;border:1px solid #cfbf9c;border-radius:4px;background:#f4efdf;color:#28475f;font-size:.8rem }
 #content #loss-table tbody tr { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:12px;row-gap:10px;margin:12px 0;padding:14px;border:1px solid #cabea5;border-radius:7px;background:#fffdf5 }
 #content #loss-table tbody td,#content #loss-table .loss-product:not([colspan]) { display:flex;flex-direction:column;gap:2px;min-width:0;padding:0;background:none;border:0;align-items:flex-start;text-align:start!important;white-space:normal;overflow-wrap:anywhere }
 #content #loss-table tbody td[data-label]:not(.loss-product)::before { content:attr(data-label);position:static;width:auto;height:auto;padding:0;display:block;font-size:.8rem;font-weight:600;color:#526579 }
 #content #loss-table tbody .loss-product { grid-column:1/-1;border-bottom:1px solid #ddd2b8;padding-bottom:8px }
 #content #loss-table tbody .loss-product::before { content:none }
 #content #loss-table tbody .loss-entry-cell { grid-column:1/-1 }
 #content #loss-table tbody .loss-entry-cell .quantity-stepper { align-self:start;margin:3px 0 0!important;grid-template-columns:44px 76px 44px 16px!important;gap:4px!important }
 #content #loss-table .quantity-stepper :is(input,.quantity-adjust,.quantity-clear),#content #loss-table .loss-price { min-height:44px;height:auto }
 #content #loss-table .quantity-stepper input { font-size:16px }
 #content #loss-table .quantity-stepper .quantity-adjust { width:44px;min-width:44px }
 #content #loss-table td.loss-price-cell { grid-column:1/-1 }
 #content #loss-table .loss-price { width:10rem }
 #content #loss-table td.loss-source { grid-column:1/-1;display:flex;flex-direction:row;align-items:center;gap:12px;min-height:44px }
 #content #loss-table td.loss-source a { display:inline-flex;align-items:center;min-height:44px }
 #content #loss-table td[colspan] { grid-column:1/-1 }
 .loss-pagination { flex-wrap:wrap }
}
@media(max-width:430px) {
 .loss-fields { grid-template-columns:minmax(0,1fr) }
 .loss-selector { align-items:flex-start;flex-direction:column }
 .loss-panelhead h2#loss-heading { font-size:1.15rem;gap:5px;padding:5px 8px }
 #loss-heading img { width:30px;height:23px }
 .loss-panelhead a { padding:8px }
}
</style>`;
