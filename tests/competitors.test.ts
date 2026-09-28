import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicWebsite,manualCompetitor,mergeManual} from '../server/competitor-core.mjs';
import {parseDiscovery,discoverCompetitors} from '../server/competitor-discovery.mjs';
import {competitorsApi} from '../server/competitors.mjs';
import {save,load} from '../server/security.mjs';
const profile={name:'Acme',website:'https://acme.com',products:'Team software',audience:'Small teams',geography:'United States'};
function response(candidates:any[]=[{name:'Beta',website:'https://beta.com',reason:'Similar team workflow tools.',evidenceUrls:['https://beta.com/products']}]){return {status:'completed',usage:{input_tokens:200,output_tokens:100},output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://beta.com/products',title:'Beta products'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates,limitations:'Search is not exhaustive.'}),annotations:[]}]}]};}
test('competitor links reject unsafe schemes, private hosts, own brand and duplicates',()=>{
 for(const url of ['javascript:alert(1)','https://127.0.0.1','https://[::1]','http://2130706433','http://user:pass@public.com','https://internal.local','https://private.internal','https://site.com:8080'])assert.throws(()=>publicWebsite(url));
 assert.equal(publicWebsite('www.beta.com/?utm_source=test'),'https://www.beta.com/');assert.throws(()=>manualCompetitor({name:'Us',website:'https://www.acme.com'},profile.website));
 const list=mergeManual([],[{name:'Beta',website:'beta.com'},{name:'Duplicate',website:'www.beta.com'}],profile.website,'now');assert.equal(list.length,1);assert.equal(list[0].status,'confirmed');
 const dismissed={...list[0],status:'dismissed'};assert.equal(mergeManual([dismissed],[{name:'Beta',website:'beta.com'}],profile.website,'later')[0].status,'dismissed');
});
test('discovery requires completed search and exact provider-returned evidence on the business domain',()=>{
 const rows=[{name:'Beta',website:'https://beta.com',reason:'Possible match',evidenceUrls:['https://beta.com/products']},{name:'Fabricated',website:'https://invented.com',reason:'Claim',evidenceUrls:['https://invented.com']},{name:'Own brand',website:'https://acme.com',reason:'Claim',evidenceUrls:['https://beta.com/products']},{name:'Duplicate',website:'https://www.beta.com',reason:'Claim',evidenceUrls:['https://beta.com/products']}];
 const data=parseDiscovery(response(rows),profile);assert.equal(data.entries.length,1);assert.equal(data.filtered,3);assert.equal(data.entries[0].status,'suggested');assert.equal(data.entries[0].evidence[0].url,'https://beta.com/products');
 assert.throws(()=>parseDiscovery({...response(),status:'incomplete'},profile));assert.throws(()=>parseDiscovery({...response(),output:response().output.slice(1)},profile));
});
test('provider request sends only selected public context and uses bounded, nonstored search',async()=>{
 let body:any;const fetcher=async(url:any,init:any)=>{assert.equal(url,'https://api.openai.com/v1/responses');body=JSON.parse(init.body);assert.equal(init.redirect,'manual');return new Response(JSON.stringify(response()));};
 const result=await discoverCompetitors({OPENAI_API_KEY:'test-only-token'},{...profile,budget:9999,approvedClaims:'Private account notes'},[],fetcher);
 assert.equal(result.entries.length,1);assert.equal(body.store,false);assert.equal(body.max_tool_calls,3);assert(!body.input.includes('Private account'));assert(!body.input.includes('9999'));assert.equal(body.tool_choice,'required');
 await assert.rejects(discoverCompetitors({OPENAI_API_KEY:'test-only-token'},profile,[],async()=>new Response('raw provider secret',{status:401})),/OpenAI rejected access/);
});
const origin='https://example.chatgpt.site';
function setup(){const map=new Map<string,{value:string;etag:string}>();let serial=0;return {COMPANY_ID:'company-a',GOOGLE_OWNER_EMAIL:'owner@example.com',GOOGLE_APP_ORIGIN:origin,OPENAI_API_KEY:'test-only-token',CONNECTION_ENCRYPTION_KEY:'ab'.repeat(32),DB:{prepare:(sql:string)=>({bind:(...args:any[])=>({first:async()=>sql.includes('company_members')?(args[1]==='member@example.com'?{role:'member'}:null):args[0]==='company-a'&&args[1]==='brand_11111111-1111-1111-1111-111111111111'?{id:args[1],name:'Other brand'}:null})})},BUCKET:{get:async(k:string)=>{const o=map.get(k);return o?{etag:o.etag,text:async()=>o.value}:null;},put:async(k:string,value:string,options:any={})=>{const o=map.get(k);if(options.onlyIf?.etagMatches&&o?.etag!==options.onlyIf.etagMatches||options.onlyIf?.etagDoesNotMatch==='*'&&o)return null;const saved={value,etag:String(++serial)};map.set(k,saved);return saved;}},map};}
function req(path:string,body?:any,email='owner@example.com',site=origin){return new Request(origin+'/api/competitors/'+path,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email,origin:site,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});}
test('API isolates brands, authorizes scans, prevents CSRF and preserves review decisions',async()=>{
 const env=setup();await save(env,'company:company-a','workspace',{profile:{...profile,competitorEntries:[{name:'Beta',website:'https://beta.com'}]}},'company');
 assert.equal((await competitorsApi(req('status',undefined,'stranger@example.com'),env)).status,403);
 assert.equal((await competitorsApi(req('sync',{},'owner@example.com','https://evil.example'),env)).status,400);
 assert.equal((await competitorsApi(req('scan',{},'member@example.com'),env)).status,403);
 const first=await (await competitorsApi(req('sync',{}),env)).json();assert.equal(first.research.entries.length,1);
 const item=first.research.entries[0];const dismissed=await (await competitorsApi(req('review',{id:item.id,status:'dismissed',expectedRevision:first.research.revision},'member@example.com'),env)).json();assert.equal(dismissed.research.entries[0].status,'dismissed');
 assert.equal((await competitorsApi(req('review',{id:item.id,status:'confirmed',expectedRevision:first.research.revision}),env)).status,409);
 const synced=await (await competitorsApi(req('sync',{}),env)).json();assert.equal(synced.research.entries[0].status,'dismissed');
 const other=await (await competitorsApi(req('status?brand=brand_11111111-1111-1111-1111-111111111111'),env)).json();assert.equal(other.research.entries.length,0);
 assert.equal((await competitorsApi(req('status?brand=brand_11111111-1111-1111-1111-111111111111'),{...env,COMPANY_ID:'other-company'})).status,404);
 assert(!JSON.stringify(synced).includes('test-only-token'));assert(![...env.map.values()].map(x=>x.value).join('').includes('Beta'));
});
test('scans deduplicate requests, retain prior data on failure and enforce daily limits',async()=>{
 const env=setup();await save(env,'company:company-a','workspace',{profile:{...profile,discoverCompetitors:true}},'company');
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify(response()));};
 try{
  const scan=await (await competitorsApi(req('scan',{automatic:true}),env)).json();assert.equal(scan.research.entries.length,1);assert.equal(scan.research.entries[0].status,'suggested');assert.equal(calls,1);
  await competitorsApi(req('scan',{automatic:true}),env);assert.equal(calls,1);
  assert.equal((await competitorsApi(req('scan',{}),env)).status,429);
  const state=await load(env,'company:company-a','competitors','research');state.attempt.at='2020-01-01T00:00:00Z';await save(env,'company:company-a','competitors',state,'research');
  globalThis.fetch=async()=>new Response('secret upstream error',{status:500});const failed=await (await competitorsApi(req('scan',{}),env)).json();assert.equal(failed.research.entries.length,1);assert.equal(failed.research.attempt.status,'failed');assert(!failed.error.includes('secret upstream'));
  const full=await load(env,'company:company-a','competitors','research');full.daily.count=3;full.attempt.at='2020-01-01T00:00:00Z';await save(env,'company:company-a','competitors',full,'research');assert.equal((await competitorsApi(req('scan',{}),env)).status,429);
 }finally{globalThis.fetch=original;}
});
test('only admins can save discovery credentials; key storage is encrypted and status never returns it',async()=>{
 const env=setup(),key='sk-test-only-abcdefghijklmnopqrst';const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(input:any,init:any)=>{calls++;assert(String(input).startsWith('https://api.openai.com/v1/models/'));assert.equal(init.headers.authorization,'Bearer '+key);return new Response('{}');};
 try{
  assert.equal((await competitorsApi(req('configure',{token:key},'member@example.com'),env)).status,403);assert.equal(calls,0);
  const saved=await competitorsApi(req('configure',{token:key}),env);assert.equal(saved.status,200);assert.equal(calls,1);
  assert.equal((await load(env,'company:company-a','openai-competitors')).token,key);
  assert(![...env.map.values()].map(v=>v.value).join('').includes(key));assert(!(await (await competitorsApi(req('status'),env)).text()).includes(key));
  globalThis.fetch=async()=>new Response('{}',{status:401});assert.equal((await competitorsApi(req('configure',{token:'sk-invalid-test-abcdefghijklmnopqrst'}),env)).status,400);assert.equal((await load(env,'company:company-a','openai-competitors')).token,key);
 }finally{globalThis.fetch=original;}
});
