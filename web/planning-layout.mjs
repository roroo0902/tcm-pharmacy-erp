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
#content .planning-mobile-sort[hidden]{display:none}
#content .planning-mobile-sort,#content .planning-mobile-help{display:none}
@media(max-width:760px){
 #content .planning-title{align-items:flex-start;gap:12px}
 #content .planning-title h2{font-size:22px}
 #content .planning-title a{font-size:13px}
 #content .planning-mobile-sort{display:flex;gap:8px;align-items:center;margin:16px 0 12px}
 #content .planning-mobile-sort label{font-size:13px;flex:0 0 auto}
 #content .planning-mobile-sort select{flex:1;min-width:0;width:0;font-size:16px;height:44px;padding:8px}
 #content .planning-mobile-sort button{flex:0 0 68px;min-height:44px;padding:8px;font-size:14px}
 #content .planning-mobile-help{display:block;margin:10px 0;font-size:13px;color:#526c7a}
 #content .planning-mobile-help summary{cursor:pointer;padding:8px 0}
 #content .planning-desktop-help{display:none}
 #content #order-table .tablewrap{overflow:visible}
 #content #order-table .order-grid{display:block;min-width:0}
 #content #order-table thead{display:none}
 #content #order-table tbody{display:block}
 #content #order-table tbody tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px;margin:12px 0;border:1px solid #d8d2bd;border-radius:10px;padding:14px;background:#fffdf5;overflow:hidden}
 #content #order-table .order-grid td{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;min-width:0!important;padding:10px 0;border:0;text-align:left!important;font-size:15px;line-height:1.5;overflow-wrap:anywhere}
 #content #order-table td:not(:first-child)::before{content:attr(data-label);font-size:12px;line-height:1.5;text-align:left;color:#526c7a}
 #content #order-table .order-grid td:first-child{grid-column:1/-1;display:flex;flex-direction:column-reverse;align-items:flex-start;gap:2px;text-align:left!important;padding:0 0 12px 48px;border-bottom:1px solid #e3dfd0;min-height:54px}
 #content #order-table td:first-child br{display:none}
 #content #order-table td:first-child b{font-size:18px;line-height:1.5}
 #content #order-table td:first-child small{font-size:12px;color:#637985}
 #content #order-table .order-grid td:first-child::before{left:0;top:8px;transform:none;width:32px;height:38px}
 #content #order-table .order-grid td:nth-child(3){grid-column:1/-1;grid-row:2;flex-direction:row;align-items:center;justify-content:space-between;background:#eef3ed;border-radius:6px;margin:12px 0 4px;padding:10px}
 #content #order-table td:nth-child(3)::before{font-size:14px;color:#203d56}
 #content #order-table .order-grid td input[data-qty]{width:94px;min-width:0;max-width:94px;margin:0;text-align:center;font-size:16px;height:44px}
 #content #order-table td:nth-child(4){grid-row:3;grid-column:2}
 #content #order-table td:nth-child(7){grid-row:3;grid-column:1}
 #content #order-table td:last-child{grid-column:1/-1;flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center;border-top:1px solid #e3dfd0;padding-top:12px;margin-top:4px;font-size:13px}
 #content #order-table td:last-child .pill{white-space:normal;max-width:100%;text-align:left}
 #content #order-table td .muted{font-size:12px}
}
</style>`;
