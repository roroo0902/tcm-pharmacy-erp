// No dependencies; browser never connects to the official app or underlying storage.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const paths=['index.html','web/hosted-app.js','qa/fixture.js','web/style.css','web/quest-theme.css','web/mobile.css','web/period-rpg-loading.js'];
const args=process.argv;
const value=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
const ref=value('--ref'),expected=value('--bundle-sha256');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(ref&&!/^[a-f0-9]{40}$/.test(ref))throw Error('Use an immutable 40-character Git commit.');
if((ref||args.includes('--assets-stdin'))&&!/^[a-f0-9]{64}$/.test(expected||''))throw Error('Expected SHA-256 is required for transferred assets.');
if(args.includes('--assets-stdin')&&ref===undefined)throw Error('Record the immutable source commit with --ref.');
const transferred=args.includes('--assets-stdin')?JSON.parse(await new Promise((ok,bad)=>{let data='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>data+=s);process.stdin.on('end',()=>ok(data));process.stdin.on('error',bad);})):null;
async function get(path){
 if(transferred){
  if(typeof transferred[path]!=='string')throw Error('Missing transferred asset '+path);
  return Buffer.from(transferred[path],'base64');
 }
 if(!ref)return readFile(resolve(root,path));
 const u='https://raw.githubusercontent.com/roroo0902/tcm-pharmacy-erp/'+ref+'/'+path;
 const r=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error(path+' download failed: '+r.status);
 return Buffer.from(await r.arrayBuffer());
}
const files=new Map(await Promise.all(paths.map(async path=>[path,await get(path)])));
const digest=createHash('sha256').update(files.get('web/hosted-app.js')).digest('hex');
if(expected&&expected!==digest)throw Error('Bundle SHA-256 mismatch; refusing to start.');
const pin=ref||execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
let shell=files.get('index.html').toString('utf8');
const entry=/<script type="module" src="\.\/web\/app\.mjs(?:\?[^"]*)?"><\/script>/g;
if([...shell.matchAll(entry)].length!==1)throw Error('ERP module entry does not match once.');
shell=shell.replace(entry,'<script src="/qa-fixture.js"></script><script src="/web/hosted-app.js"></script>');
shell=shell.replace(/https:\/\/roroo0902\.github\.io\/tcm-pharmacy-erp\/web\/period-rpg-loading\.js[^"]*/g,'/web/period-rpg-loading.js');
files.set('index.html',Buffer.from(shell));
const routes=new Map(paths.map(p=>['/'+p,p]));
routes.set('/','index.html');routes.set('/qa-fixture.js','qa/fixture.js');
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; worker-src 'none'";
const server=createServer((req,res)=>{
 const p=routes.get(new URL(req.url,'http://127.0.0.1').pathname);
 res.setHeader('Content-Security-Policy',csp);
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'||!p){res.writeHead(404);res.end();return;}
 const media=p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html';
 res.writeHead(200,{'Content-Type':media+'; charset=utf-8'});
 res.end(files.get(p));
});
const port=Number(value('--port')||0);
server.listen(port,'127.0.0.1',async()=>{
 const origin='http://127.0.0.1:'+server.address().port;
 console.log(JSON.stringify({origin,pin,bundleSha256:digest,assets:Object.fromEntries(paths.map(p=>[p,files.get(p).byteLength]))}));
 if(args.includes('--verify')){
  try{
   const h=await fetch(origin+'/'),b=await fetch(origin+'/web/hosted-app.js');
   const html=await h.text(), bytes=Buffer.from(await b.arrayBuffer());
   if(h.headers.get('content-security-policy')!==csp||html.indexOf('/qa-fixture.js')>=html.indexOf('/web/hosted-app.js')||!bytes.equals(files.get('web/hosted-app.js')))throw Error('Loopback fixture self-check failed.');
   console.log('PASS loopback policy and exact production-bundle bytes. Browser not exercised.');
  }catch(e){console.error(e);process.exitCode=1;}finally{server.close();}
 }else setTimeout(()=>server.close(),15*60*1000).unref();
});
