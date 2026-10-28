# 庫存 J1：預估庫存天數

六個庫存分頁使用同一公式。保持本週50%、前週30%、前二週10%、前三週10%的權重。只計每日欄，排除入貨與週合計；動態涵蓋新增日期欄。庫存空白或無有效平均量時留白，零庫存顯示0。

```excel
=ARRAYFORMULA({"預估";"庫存天數";MAP(SEQUENCE(ROWS(B3:B),1,3),B3:B,LAMBDA(r,code,IF(code="","",LET(stock,INDEX(G:G,r),u,INDIRECT("N"&r&":"&ADDRESS(r,COLUMNS(1:1),4)),d,INDIRECT("N1:"&ADDRESS(1,COLUMNS(1:1),4)),k,INDIRECT("N2:"&ADDRESS(2,COLUMNS(1:1),4)),valid,REGEXMATCH(k&"","^[一二三四五六日]$"),t,TODAY(),w,WEEKDAY(t,2),hols,'休診日期'!B:B,cur,t-w+1,wd,MAX(0,MIN(w,6)-COUNTIFS(hols,">="&cur,hols,"<="&t)),dayuse,SUMPRODUCT(IFERROR(u*1,0),N(d=t),N(valid)),weekuse,SUMPRODUCT(IFERROR(u*1,0),N(d>=cur),N(d<=t),N(valid)),avgcur,IF(wd<=1,dayuse,0.2*dayuse+0.8*(weekuse-dayuse)/MAX(1,wd-1)),hist,LAMBDA(n,LET(s,cur-7*n,e,s+5,den,6-COUNTIFS(hols,">="&s,hols,"<="&e),IFERROR(SUMPRODUCT(IFERROR(u*1,0),N(d>=s),N(d<=e),N(valid))/den,0))),avg,0.5*avgcur+0.3*hist(1)+0.1*hist(2)+0.1*hist(3),IF(stock="","",IF(stock=0,0,IF(avg>0,ROUND(stock/avg,1),"")))))))})
```

