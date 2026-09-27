// Fixed reporting-only MCP client. No caller-controlled URLs or tool names.
const endpoint='https://mcp.zapier.com/api/v1/connect';
// Classify provider errors without returning their raw payloads, which can contain credentials.
function actionError(payload){
 const detail=JSON.stringify(payload??{});
 if(/USER_PERMISSION_DENIED|(?:doesn.t have|lacks|does not have) permission to access customer/i.test(detail))return new Error('Google Ads denied access to the requested advertising account. In Zapier, check that the default Google Ads connection can access this account through the selected manager, then reconnect that Google Ads connection if needed.'+(/data partner/i.test(detail)?' Zapier also asks you to confirm its data-partner approval.':'')+' After resolving access, select Refresh now.');
 if(/invalid_grant|expired.{0,30}(?:credential|token)|(?:credential|token).{0,30}(?:expired|revoked)/i.test(detail))return new Error('The Google app authorization in Zapier has expired or was revoked. Reconnect the affected Google app in Zapier, then select Refresh now.');
 return new Error('Zapier rejected the report. Open your Subgrowth Website server’s History tab and inspect the failed Google reporting action for the exact cause.');
}
export function unpack(result){
 if(result?.isError)throw actionError(result);
 if(result?.structuredContent){if(result.structuredContent.error_code||result.structuredContent.error||result.structuredContent.isError)throw actionError(result);return result.structuredContent;}
 const texts=(result?.content??[]).filter(c=>c.type==='text').map(c=>c.text);
 for(const text of texts){let value;try{value=JSON.parse(text);}catch{continue;}if(value?.isError||value?.error||value?.error_code)throw actionError(value);return value;}
 throw new Error('Zapier returned an unsupported report format.');
}
export async function mcpClient(token){
 let id=0,session='',version='2025-11-25';
 async function rpc(method,params,notification=false){
  const requestId=++id;
  const response=await fetch(endpoint,{method:'POST',redirect:'manual',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json, text/event-stream','MCP-Protocol-Version':version,...(session?{'MCP-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id:requestId}),method,params}),signal:AbortSignal.timeout(45000)});
  if(response.status>=300&&response.status<400){await response.body?.cancel();throw new Error('Zapier returned an unexpected redirect. Your connection token was not forwarded.');}
  if(!response.ok)throw new Error([401,403].includes(response.status)?'Zapier rejected the connection token. Check it in Connections.':`Zapier is unavailable (${response.status}). Try Refresh now later.`);
  session=response.headers.get('mcp-session-id')??session;
  if(notification){await response.body?.cancel();return;}
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',length=0;const streaming=response.headers.get('content-type')?.includes('text/event-stream');
  const finish=value=>{if(value.id!==requestId)throw new Error('Zapier returned an unexpected response.');if(value.error)throw new Error('Zapier could not complete the reporting request. Check the connection and enabled tools.');return value.result;};
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>8000000)throw new Error('Zapier report is too large. Narrow the report.');buffer+=decoder.decode(value,{stream:true});if(streaming){let boundary;while((boundary=buffer.search(/\r?\n\r?\n/))>=0){const event=buffer.slice(0,boundary),match=buffer.slice(boundary).match(/^\r?\n\r?\n/)[0];buffer=buffer.slice(boundary+match.length);const text=event.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(text){const parsed=JSON.parse(text);if(parsed.id===requestId)return finish(parsed);}}}}
   if(streaming)throw new Error('Zapier report stream ended before completion.');return finish(JSON.parse(buffer));
  }finally{await reader.cancel().catch(()=>{});}
 }
 const initialized=await rpc('initialize',{protocolVersion:version,capabilities:{},clientInfo:{name:'subgrowth-reporting',version:'1.0.0'}});version=initialized.protocolVersion;await rpc('notifications/initialized',{},true);
 const tools=[];let cursor;do{const result=await rpc('tools/list',cursor?{cursor}:{});tools.push(...result.tools);cursor=result.nextCursor;if(tools.length>500)throw new Error('Too many tools on this Zapier server. Use a dedicated reporting server.');}while(cursor);
 const named=name=>{const tool=tools.find(t=>t.name===name);if(!tool)throw new Error('This website requires Zapier Agentic mode. In your Subgrowth Website server, open Settings, select Agentic mode, and save changes. Then try saving the same token again. Managed mode exposes a different set of tools.');return tool.name;};
 return {async inspect(args){return unpack(await rpc('tools/call',{name:named('inspect_zapier_actions'),arguments:args}));},async execute(args){return unpack(await rpc('tools/call',{name:named('execute_zapier_write_action'),arguments:args}));},async close(){if(session)await fetch(endpoint,{method:'DELETE',redirect:'manual',headers:{Authorization:`Bearer ${token}`,'MCP-Session-Id':session,'MCP-Protocol-Version':version},signal:AbortSignal.timeout(5000)}).then(r=>r.body?.cancel()).catch(()=>{});}};
}
export function reportData(source,data,settings,range){
 const reports=data?.results;if(!Array.isArray(reports))throw new Error('Zapier returned an unsupported report shape.');
 const base={source,provider:'Zapier MCP',start:range.start,end:range.end,collectedAt:new Date().toISOString()};
 if(source==='ga4'){
  const report=reports[0];if(!report||!Array.isArray(report.metricHeaders))throw new Error('GA4 report is missing metric definitions.');
  const metrics=['sessions','keyEvents','sessionKeyEventRate','totalRevenue'];
  const positions=metrics.map(name=>report.metricHeaders.findIndex(h=>h.name===name));if(positions.some(i=>i<0))throw new Error('GA4 report is missing required metrics.');
  const dim=report.dimensionHeaders?.findIndex(h=>h.name==='landingPage');if(dim==null||dim<0)throw new Error('GA4 report is missing landing pages.');
  const rows=report.rows??[];if((report.rowCount??rows.length)>rows.length||rows.length>=10000)throw new Error('GA4 report exceeds this view’s 10,000-row limit. The previous report is preserved.');
  const metadata=report.metadata??{},limitations=['Key events are event counts; the session key-event rate is provided directly by GA4.','Recent data may change as Google finishes processing.'];if(metadata.subjectToThresholding)limitations.push('Google reporting thresholds may withhold data.');if(metadata.samplingMetadatas?.length)limitations.push('This report contains sampled data.');if(metadata.dataLossFromOtherRow)limitations.push('Some data is grouped into an (other) row.');
  return {...base,account:{id:settings.propertyId,name:settings.propertyName,currency:metadata.currencyCode??'Unavailable',timezone:metadata.timeZone??'Unavailable'},columns:['Landing page','Sessions','Key events','Session key event rate','Total revenue'],rateColumn:3,rows:rows.map(r=>[r.dimensionValues[dim].value,...positions.map(i=>r.metricValues[i].value)]),limitations};
 }
 // Google Ads' Zapier action may wrap the Google query response in one results object.
 const rows=reports.length===1&&Array.isArray(reports[0]?.results)?reports[0].results:reports;
 if(rows.length>=10000)throw new Error('Google Ads report reached the row limit. The previous report is preserved.');
 if(rows.some(r=>!r.campaign||!r.metrics))throw new Error('Google Ads report format could not be verified. The previous report is preserved.');
 const customer=rows[0]?.customer??{};
 return {...base,account:{id:settings.customerId,name:customer.descriptiveName??settings.customerId,currency:customer.currencyCode??'Unavailable',timezone:customer.timeZone??'Unavailable'},columns:['Campaign','Campaign ID','Impressions','Clicks','Spend','Conversions','Conversion value'],rows:rows.map(r=>[r.campaign.name,r.campaign.id,r.metrics.impressions??'0',r.metrics.clicks??'0',r.metrics.costMicros==null?'Unavailable':String(Number(r.metrics.costMicros)/1e6),r.metrics.conversions??'0',r.metrics.conversionsValue??'0']),limitations:['Conversions follow the account’s primary conversion settings and may arrive later. Fractional conversions are preserved.']};
}
function adsResponse(data){
 const response=data?.results?.[0];
 if(data?.results?.length!==1||!response||!Number.isInteger(response.status))throw new Error('Zapier returned an unsupported Google Ads API response.');
 let body=response.body;
 if(typeof body==='string'){try{body=JSON.parse(body);}catch{throw new Error('Google Ads returned an unreadable report.');}}
 if(response.status!==200||body?.error)throw actionError(body);
 if(!body||(!Array.isArray(body.results)&&typeof body.fieldMask!=='string'))throw new Error('Google Ads report format could not be verified.');
 if(body.nextPageToken)throw new Error('Google Ads report exceeds this view’s 10,000-row limit. The previous report is preserved.');
 return {results:body.results??[]};
}
export async function fetchReport(client,source,settings){
 if(!['ga4','ads'].includes(source))throw new Error('Choose Google Analytics or Google Ads.');
 const end=new Date(Date.now()-86400000).toISOString().slice(0,10),start=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
 let args;
 if(source==='ga4')args={selected_api:'GoogleAnalytics4CLIAPI',action:'runReport',tool_name:'google_analytics_4_run_report_for_a_property',params:{accountId:settings.accountId,propertyId:settings.propertyId,dimensions:['landingPage'],metrics:['sessions','keyEvents','sessionKeyEventRate','totalRevenue'],startDate:start,endDate:end,dateName:'recent',limit:10000,offset:0}};
 else{
  if(!/^\d{10}$/.test(settings.managerId??'')||!/^\d{10}$/.test(settings.customerId??''))throw new Error('Configure valid Google Ads manager and advertising account IDs on the website.');
  // Google Ads search uses POST to read reports. This fixed endpoint and SELECT cannot mutate ads.
  // Zapier's built-in Create Report failed for this manager/customer pair; explicit login-customer-id succeeds.
  args={selected_api:'GoogleAdsCLIAPI',action:'_zap_raw_request',tool_name:'google_ads_make_api_mutating_request',params:{method:'POST',url:'https://googleads.googleapis.com/v25/customers/'+settings.customerId+'/googleAds:search',headers:{'login-customer-id':settings.managerId,'content-type':'application/json'},body:JSON.stringify({query:"SELECT campaign.id, campaign.name, customer.currency_code, customer.time_zone, customer.descriptive_name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '"+start+"' AND '"+end+"' LIMIT 10000"}),fail_on_errors:false}};
 }
 const schema=await client.inspect({tool_name:args.tool_name,params:args.params});
 if(!Array.isArray(schema)||!schema.some(app=>app.actions?.some(a=>a.tool_name===args.tool_name)))throw new Error(source==='ads'?'Enable Google Ads API Request (Make API Mutating Request) in your Subgrowth Website Zapier server and select the default Google Ads connection. The website uses it only for a fixed read-only report query.':'Enable this report action and choose its default Google connection in Zapier.');
 const data=await client.execute(args);
 return reportData(source,source==='ads'?adsResponse(data):data,settings,{start,end});
}
