import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restoreNavigationIcons} from '../web/navigation-icons.mjs';
test('old synced shell icons become inline without changing links or labels; repeated restoration is stable',()=>{
 const links=['overview','orders','receive','photoReceive','loss','history','items','backup'].map(name=>{
 const svg={innerHTML:'<use href="https://other.test/menu-icons.svg#'+name+'"/>',setAttribute(k,v){this[k]=v;},querySelector(){return this.innerHTML.includes('<use')?{}:null;}};
 return {name,label:name,svg,getAttribute(){return '#'+name;},querySelector(){return svg;}};
 });
 const root={querySelectorAll(){return links;}};restoreNavigationIcons(root);
 for(const l of links){assert.match(l.svg.innerHTML,/<path /);assert.doesNotMatch(l.svg.innerHTML,/<use/);assert.equal(l.svg.viewBox,'0 0 24 24');assert.equal(l.label,l.name);}
 const before=JSON.stringify(links);restoreNavigationIcons(root);assert.equal(JSON.stringify(links),before);
});
test('missing icons are added while external inventory links are untouched',()=>{
 let added='';const root={querySelectorAll:()=>[{getAttribute:()=> '#items',querySelector:()=>null,insertAdjacentHTML:(p,s)=>added=s},{getAttribute:()=> 'https://docs.google.com/spreadsheets/d/existing',querySelector:()=>{throw Error('external link changed');}}]};
 restoreNavigationIcons(root);assert.match(added,/viewBox="0 0 24 24"/);
});
test('both generated and static shells have no external SVG use in menu',()=>{
 for(const file of ['index.html','gas/cloud/App.html']){const html=readFileSync(file,'utf8');const nav=html.match(/<nav[\s\S]*?<\/nav>/)[0];assert.doesNotMatch(nav,/<use\b/);assert.match(nav,/<path /);}
});
