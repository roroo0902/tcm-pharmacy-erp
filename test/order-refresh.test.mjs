import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileOrderInputs} from '../web/order-refresh.mjs';
import {orderKey,orderLines} from '../web/order-grid-data.mjs';
test('refresh preserves quantities and edited prices on unique code rename across suppliers',()=>{
 const a={name:'富田單方',code:'A1',drug:'舊名',bottles:10},b={...a,name:'科達單方'};
 const q=new Map([[orderKey(a),'3'],[orderKey(b),'7']]),p=new Map([[orderKey(a),'0']]);
 const next=[{...a,drug:'新名'},b];reconcileOrderInputs([a,b],next,q,p);
 assert.equal(q.get(orderKey(next[0])),'3');assert.equal(p.get(orderKey(next[0])),'0');assert.equal(q.get(orderKey(b)),'7');
 assert.equal(orderLines(next,q,p).find(l=>l.sheet==='富田單方').name,'新名');
});
test('deleted or duplicate codes retain unresolved input and cannot silently post',()=>{
 const a={name:'富田單方',code:'A1',drug:'舊名',bottles:10};
 for(const next of [[],[{...a,drug:'新一'},{...a,drug:'新二'}]]){
  const q=new Map([[orderKey(a),'3']]);reconcileOrderInputs([a],next,q,new Map());assert.equal(q.get(orderKey(a)),'3');assert.throws(()=>orderLines(next,q));
 }
});
