// Presentation only: preserve planning calculations and sorting keys.
export const planningLayout = `<style>
#content .planning-title{align-items:center;gap:24px}
#content .planning-title h2{font-size:28px;font-weight:700;line-height:1.4;letter-spacing:1px;margin:0 0 10px}
#content .planning-title p{margin:0;line-height:1.7}
#content #order-table .order-grid{table-layout:fixed;width:100%;min-width:1180px;white-space:normal}
#content #order-table .order-grid th,#content #order-table .order-grid td{text-align:center!important;vertical-align:middle!important;padding:16px 10px;line-height:1.5;overflow-wrap:anywhere}
#content #order-table .order-grid th{height:88px;font-size:14px;font-weight:500;border-right:1px solid #ffffff25;border-bottom:2px solid #c9a952}
#content #order-table .order-grid th:first-child{width:16%}
#content #order-table .order-grid th:nth-child(3){width:11%;min-width:0}
#content #order-table .order-grid th:nth-child(6),#content #order-table .order-grid th:nth-child(8){width:11%}
#content #order-table .order-sort{display:flex;align-items:center;justify-content:center;gap:4px;min-height:28px;line-height:1.5;width:100%;font-size:14px;white-space:nowrap}
#content #order-table .planning-subtitle{display:block;line-height:1.5;margin-top:4px;font-size:13px}
#content #order-table .order-grid td input[data-qty]{width:100%;min-width:0;max-width:125px;margin-inline:auto;text-align:center}
#content #order-table .order-grid td:first-child{padding-left:54px;padding-right:12px}
#content #order-table .order-grid td:first-child::before{width:36px;height:40px;left:10px}
#content #order-table .order-grid td .muted{font-size:12px;line-height:1.6}
@media(max-width:760px){
 #content .planning-title{align-items:flex-start;gap:12px}
 #content .planning-title h2{font-size:23px}
 #content .planning-title a{font-size:13px}
 #content #order-table .tablewrap{overflow:visible}
 #content #order-table .order-grid{display:block;min-width:0}
 #content #order-table thead,#content #order-table tbody{display:block}
 #content #order-table thead tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#ffffff25}
 #content #order-table .order-grid th{display:flex;flex-direction:column;justify-content:center;width:auto!important;min-width:0;height:auto;min-height:76px;padding:8px 4px;border:0;background:#203d56}
 #content #order-table .order-sort{min-height:32px;font-size:12px;white-space:normal}
 #content #order-table .planning-subtitle{font-size:12px}
 #content #order-table tbody tr{display:block;margin:12px 0;border:1px solid #ccc7b6;border-radius:8px;padding:8px;background:#fffdf5}
 #content #order-table .order-grid td{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;min-width:0!important;padding:10px 8px;border:0;text-align:right!important}
 #content #order-table td:not(:first-child)::before{content:attr(data-label);font-size:12px;text-align:left;color:#526c7a;margin-right:auto}
 #content #order-table .order-grid td:first-child{display:block;text-align:center!important;padding:12px 44px}
 #content #order-table .order-grid td input[data-qty]{width:110px;margin:0 0 0 auto}
 #content #order-table td .muted{flex-basis:100%}
}
</style>`;
