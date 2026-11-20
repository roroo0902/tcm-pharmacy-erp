export function lossPage(rows,page=1,size=10){
 if(![10,20,30].includes(size))size=10;
 const total=rows.length,pages=Math.max(1,Math.ceil(total/size));
 page=Math.min(pages,Math.max(1,Math.trunc(page)||1));
 const offset=(page-1)*size;
 return {page,pages,total,start:total?offset+1:0,end:Math.min(offset+size,total),rows:rows.slice(offset,offset+size)};
}
