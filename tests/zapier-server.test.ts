import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zapierApi} from '../server/zapier.mjs';
import {mcpClient,reportData,unpack,fetchReport} from '../server/zapier-mcp.mjs';
import {save,load} from '../server/security.mjs';
const origin='https://example.chatgpt.site';
function env(){const map=new Map<string,string>();return {COMPANY_ID:'test-company',DB:{prepare:()=>({bind:()=>({first:async()=>null})})},GOOGLE_APP_ORIGIN:origin,GOOGLE_OWNER_EMAIL:'owner@example.com',CONNECTION_ENCRYPTION_KEY:'ab'.repeat(32),BUCKET:{get:async(k:string)=>map.has(k)?{text:async()=>map.get(k)}:null,put:async(k:string,v:string)=>{map.set(k,v);}},map};}
function req(path:string,body?:unknown,requestOrigin=origin){return new Request(origin+'/api/zapier/'+path,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com',origin:requestOrigin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});}
test('Zapier routes reject outsiders and cross-origin token submissions',async()=>{const e=env();assert.equal((await zapierApi(new Request(origin+'/api/zapier/status'),e)).status,401);assert.equal((await zapierApi(req('configure',{token:'private-token-secret-long'},'https://other.example'),e)).status,400);assert.equal(e.map.size,0);});
test('Zapier status never returns its encrypted connection token',async()=>{const e=env();await save(e,'company:test-company','zapier',{token:'private-token-secret-long'});const status=await (await zapierApi(req('status'),e)).text();assert(!status.includes('private-token'));assert(![...e.map.values()].join('').includes('private-token'));assert(JSON.parse(status).configured);});
test('GA4 normalization matches headers, preserves rates and rejects truncation',()=>{const data={results:[{dimensionHeaders:[{name:'landingPage'}],metricHeaders:[{name:'totalRevenue'},{name:'sessions'},{name:'keyEvents'},{name:'sessionKeyEventRate'}],rows:[{dimensionValues:[{value:'/'}],metricValues:[{value:'0'},{value:'10'},{value:'2'},{value:'0.1'}]}],rowCount:1,metadata:{currencyCode:'USD',timeZone:'America/Los_Angeles',subjectToThresholding:true}}]};const r=reportData('ga4',data,{propertyId:'properties/1',propertyName:'Example'},{start:'2026-08-01',end:'2026-08-30'});assert.deepEqual(r.rows[0],['/','10','2','0.1','0']);assert(r.limitations.some((s:string)=>s.includes('threshold')));data.results[0].rowCount=2;assert.throws(()=>reportData('ga4',data,{},{}),/limit/);assert.throws(()=>unpack({content:[{type:'text',text:'{"isError":true,"error":"permission"}'}]}),/rejected/);});
test('MCP handshake supports JSON and SSE and only offers reporting meta-tools',async()=>{const original=globalThis.fetch;const methods:string[]=[];globalThis.fetch=async(input:any,init:any)=>{assert.equal(String(input),'https://mcp.zapier.com/api/v1/connect');assert.equal(init.redirect,'manual');assert.equal(init.headers.Authorization,'Bearer private-token');if(init.method==='DELETE')return new Response(null,{status:204});const message=JSON.parse(init.body);methods.push(message.method);if(message.method==='notifications/initialized')return new Response(null,{status:202});const result=message.method==='initialize'?{protocolVersion:'2025-11-25'}:message.method==='tools/list'?{tools:[{name:'inspect_zapier_actions'},{name:'execute_zapier_write_action'}]}:{content:[{type:'text',text:'[]'}]};const payload=JSON.stringify({jsonrpc:'2.0',id:message.id,result});return new Response(message.method==='tools/call'?'event: message\ndata: '+payload+'\n\n':payload,{headers:{'content-type':message.method==='tools/call'?'text/event-stream':'application/json','mcp-session-id':'session'}});};try{const client=await mcpClient('private-token');assert.deepEqual(await client.inspect({selected_api:'GoogleAnalytics4CLIAPI'}),[]);assert.equal((client as any).rpc,undefined);await client.close();assert.deepEqual(methods,['initialize','notifications/initialized','tools/list','tools/call']);}finally{globalThis.fetch=original;}});
test('failed Zapier sync keeps last good data and subsequent automatic attempt is cached',async()=>{const e=env();await save(e,'company:test-company','zapier',{token:'secret-long-token'});await save(e,'company:test-company','zapier-ga4',{rows:[['prior']]},'report');const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:401});};try{const first=await zapierApi(req('sync',{source:'ga4'}),e);assert.equal(first.status,502);assert.deepEqual((await first.json()).report.rows,[['prior']]);assert.deepEqual((await load(e,'company:test-company','zapier-ga4','report')).rows,[['prior']]);const second=await (await zapierApi(req('sync',{source:'ga4'}),e)).json();assert(second.cached);assert.equal(calls,1);}finally{globalThis.fetch=original;}});

test('MCP rejects redirects without forwarding the token or exposing the redirect target',async()=>{const original=globalThis.fetch;for(const status of [301,302,303,307,308]){let calls=0;globalThis.fetch=async(input:any,init:any)=>{calls++;assert.equal(String(input),'https://mcp.zapier.com/api/v1/connect');assert.equal(init.redirect,'manual');return new Response(null,{status,headers:{location:'https://untrusted.example/collect?secret=private-token'}});};try{await assert.rejects(mcpClient('private-token'),(error:Error)=>error.message.includes('not forwarded')&&!error.message.includes('private-token')&&!error.message.includes('untrusted'));assert.equal(calls,1);}finally{globalThis.fetch=original;}}});

test('managed-mode configuration explains the mode mismatch without storing the token or running actions',async()=>{
 const original=globalThis.fetch,e=env();let closed=false;
 globalThis.fetch=async(_input:any,init:any)=>{
  if(init.method==='DELETE'){closed=true;return new Response(null,{status:204});}
  const message=JSON.parse(init.body);
  assert.notEqual(message.method,'tools/call');
  if(message.method==='notifications/initialized')return new Response(null,{status:202});
  const result=message.method==='initialize'?{protocolVersion:'2025-11-25'}:{tools:[{name:'google_analytics_4_run_report_for_a_property'},{name:'google_ads_create_report'}]};
  return new Response(JSON.stringify({jsonrpc:'2.0',id:message.id,result}),{headers:{'content-type':'application/json','mcp-session-id':'test-session'}});
 };
 try{
  const response=await zapierApi(req('configure',{token:'private-token-secret-long',settings:{accountId:'accounts/123',propertyId:'properties/456',managerId:'1234567890',customerId:'9876543210'}}),e);
  assert.equal(response.status,400);
  const body=await response.json();assert.match(body.error,/Agentic mode/);assert.match(body.error,/same token/);assert(!body.error.includes('private-token'));
  assert.equal(await load(e,'company:test-company','zapier'),null);assert(closed);
 }finally{globalThis.fetch=original;}
});

test('provider permission errors retain actionable guidance without exposing raw payloads',()=>{
 const error="User doesn't have permission to access customer. Please confirm you've approved Zapier as a data partner. Bearer secret-do-not-display";
 for(const result of [
  {isError:true,structuredContent:{error_code:'INVALID_ARGUMENT'},content:[{type:'text',text:JSON.stringify({isError:true,error})}]},
  {content:[{type:'text',text:JSON.stringify({isError:true,error})}]},
  {structuredContent:{error_code:'USER_PERMISSION_DENIED',error}},
 ])assert.throws(()=>unpack(result),(e:Error)=>e.message.includes('Google Ads denied access')&&e.message.includes('data-partner')&&!e.message.includes('secret-do-not-display'));
 assert.throws(()=>unpack({isError:true,content:[{type:'text',text:'Unknown failure: secret-do-not-display'}]}),(e:Error)=>e.message.includes('History tab')&&!e.message.includes('secret-do-not-display'));
 assert.throws(()=>unpack({structuredContent:{error:'invalid_grant'}}),/Reconnect the affected Google app/);
 // Error-like strings in successful report cells are data, not provider errors.
 const data={results:[{campaign:{name:'USER_PERMISSION_DENIED'}}]};assert.deepEqual(unpack({structuredContent:data}),data);
});

const adsSettings={managerId:'1234567890',customerId:'9876543210'};
function adsClient(response:unknown){return {inspect:async()=>[{actions:[{tool_name:'google_ads_make_api_mutating_request'}]}],execute:async()=>response};}
test('Google Ads uses a fixed read-only search with explicit manager context and matching report dates',async()=>{
 let request:any;
 const client=adsClient({results:[{status:200,headers:{private:'not-for-browser'},body:{results:[{customer:{currencyCode:'USD',timeZone:'America/Los_Angeles'},campaign:{id:'1',name:'Example'},metrics:{costMicros:'12345000',conversions:'1.5',impressions:'80',clicks:'4',conversionsValue:'90'}}]}}]});
 const execute=client.execute;client.execute=async(...args:any[])=>{request=args[0];return execute();};
 const report=await fetchReport(client,'ads',adsSettings);
 assert.equal(request.tool_name,'google_ads_make_api_mutating_request');assert.equal(request.params.method,'POST');
 assert.equal(request.params.url,'https://googleads.googleapis.com/v25/customers/9876543210/googleAds:search');
 assert.equal(request.params.headers['login-customer-id'],'1234567890');
 const query=JSON.parse(request.params.body).query;
 assert.match(query,/^SELECT /);assert(query.includes(`BETWEEN '${report.start}' AND '${report.end}'`));assert.match(query,/LIMIT 10000$/);
 assert.deepEqual(report.rows,[['Example','1','80','4','12.345','1.5','90']]);
 assert(!JSON.stringify(report).includes('not-for-browser'));
});
test('Google Ads refuses partial, unverified and denied responses while accepting an empty verified report',async()=>{
 await assert.rejects(fetchReport(adsClient({results:[{status:200,body:{results:[],nextPageToken:'next'}}]}),'ads',adsSettings),/10,000-row limit/);
 await assert.rejects(fetchReport(adsClient({results:[{status:200,body:{}}]}),'ads',adsSettings),/could not be verified/);
 await assert.rejects(fetchReport(adsClient({results:[{status:403,body:{error:{message:'USER_PERMISSION_DENIED secret-test'}}}]}),'ads',adsSettings),(e:Error)=>e.message.includes('denied access')&&!e.message.includes('secret-test'));
 const empty=await fetchReport(adsClient({results:[{status:200,body:{fieldMask:'campaign.id'}}]}),'ads',adsSettings);assert.deepEqual(empty.rows,[]);
});
test('invalid Ads routing and a missing report tool fail before execution',async()=>{
 const client={inspect:async()=>[],execute:async()=>{assert.fail('Must not run an unverified request');}};
 await assert.rejects(fetchReport(client,'ads',{...adsSettings,customerId:'9876543210/googleAds:mutate'}),/valid Google Ads/);
 await assert.rejects(fetchReport(client,'ads',adsSettings),/Enable Google Ads API Request/);
});
