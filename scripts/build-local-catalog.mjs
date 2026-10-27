import fs from 'node:fs';
import {checkCatalog} from '../web/catalog-data.mjs';
const source=JSON.parse(fs.readFileSync('data/excel-import.json','utf8'));
const records=source.records.map(r=>({id:r.proposedId,name:r.name,brand:r.brand,category:r.category,code:String(r.code??''),sourceKey:r.sourceKey,referenceBottles:r.referenceBottles===''?null:r.referenceBottles??null,stockDate:r.stockDate??'',warnings:r.warnings}));
checkCatalog(records);
const output={kind:'tcm-catalog',version:1,sourceFile:source.sourceFile,sourceSha256:source.sourceSha256,records};
fs.writeFileSync('data/藥品名冊_650筆_待盤點.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({records:records.length,warnings:records.filter(r=>r.warnings.length).length,missingCode:records.filter(r=>!r.code).length}));
