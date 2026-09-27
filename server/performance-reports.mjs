const offset=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export function performanceRange(now,timezone,lagDays){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(now),end=offset(today,-lagDays),start=offset(end,-27),previousEnd=offset(start,-1),previousStart=offset(start,-28);
 return {start,end,previousStart,previousEnd,lagDays,timezone};
}
const schemas={traffic:{dimensions:['date','sessionDefaultChannelGroup'],metrics:['sessions','engagedSessions','keyEvents','totalRevenue']},acquisition:{dimensions:['date','firstUserDefaultChannelGroup'],metrics:['newUsers']},events:{dimensions:['date','eventName'],metrics:['eventCount']}};
const number=(value,signed=false)=>{if(value===null||value===undefined||value==='')throw new Error('A required report metric is missing.');const result=Number(value);if(!Number.isFinite(result)||(!signed&&result<0))throw new Error('A report metric could not be verified.');return result;};
function date(value){if(!/^\d{8}$/.test(value??''))throw new Error('A report date is missing.');return value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6);}
export function normalizePerformance(kind,data,settings,range,query){
 const base={kind,start:range.previousStart,end:range.end,range,collectedAt:new Date().toISOString(),provider:'Zapier MCP',limitations:[],query};
 if(kind!=='paid'){
  const shape=schemas[kind],report=data?.results?.[0];if(!report||!Array.isArray(report.metricHeaders)||!Array.isArray(report.dimensionHeaders))throw new Error('Google Analytics returned an unsupported report.');
  const dims=shape.dimensions.map(n=>report.dimensionHeaders.findIndex(h=>h.name===n)),metrics=shape.metrics.map(n=>report.metricHeaders.findIndex(h=>h.name===n));
  if([...dims,...metrics].some(v=>v<0))throw new Error('Google Analytics omitted a required dimension or metric.');
  const rows=report.rows??[];if(!Array.isArray(rows)||(report.rowCount??rows.length)>rows.length||rows.length>=10000)throw new Error('This report exceeds the 10,000-row limit. Prior data is preserved.');
  const meta=report.metadata??{};if(meta.subjectToThresholding)base.limitations.push('Google reporting thresholds may withhold data.');if(meta.samplingMetadatas?.length)base.limitations.push('Google returned sampled data.');if(meta.dataLossFromOtherRow)base.limitations.push('Google grouped some data into an (other) row.');
  const seen=new Set();const mapped=rows.map(row=>{const day=date(row.dimensionValues?.[dims[0]]?.value),dimension=row.dimensionValues?.[dims[1]]?.value;if(typeof dimension!=='string'||day<base.start||day>base.end)throw new Error('Google returned an invalid dimension or date.');const key=day+'|'+dimension;if(seen.has(key))throw new Error('Google returned duplicate reporting rows.');seen.add(key);return {date:day,[kind==='events'?'event':'channel']:dimension,...Object.fromEntries(shape.metrics.map((metric,i)=>[metric,number(row.metricValues?.[metrics[i]]?.value,metric==='totalRevenue')]))};});
  return {...base,account:{id:settings.propertyId,name:settings.propertyName||settings.propertyId,currency:meta.currencyCode??'Unavailable',timezone:meta.timeZone??'Unavailable'},rows:mapped};
 }
 const response=data?.results?.[0];let payload=response?.body;if(typeof payload==='string'){try{payload=JSON.parse(payload);}catch{throw new Error('Google Ads returned an unreadable report.');}}
 if(data?.results?.length!==1||response?.status!==200||payload?.error)throw new Error('Google Ads rejected the performance query. Check the selected account and permissions in Zapier History.');
 if(!payload||(!Array.isArray(payload.results)&&typeof payload.fieldMask!=='string'))throw new Error('Google Ads returned an unsupported report.');
 const rows=payload.results??[];if(payload.nextPageToken||rows.length>=10000)throw new Error('Google Ads exceeded the 10,000-row limit. Prior data is preserved.');
 const customer=rows[0]?.customer??{},seen=new Set();
 const mapped=rows.map(r=>{const day=r.segments?.date,id=r.campaign?.id;if(!/^\d{4}-\d{2}-\d{2}$/.test(day??'')||day<base.start||day>base.end||!id||!r.metrics)throw new Error('Google Ads omitted a required campaign or date.');const key=day+'|'+id;if(seen.has(key))throw new Error('Google Ads returned duplicate campaign-day rows.');seen.add(key);if(r.customer?.currencyCode!==customer.currencyCode)throw new Error('Google Ads mixed currencies in one report.');return {date:day,id:String(id),name:r.campaign.name||String(id),network:r.campaign.advertisingChannelType||'Unknown',impressions:number(r.metrics.impressions??0),clicks:number(r.metrics.clicks??0),spend:number(r.metrics.costMicros??0)/1e6,conversions:number(r.metrics.conversions??0),value:number(r.metrics.conversionsValue??0,true)};});
 return {...base,account:{id:settings.customerId,name:customer.descriptiveName??settings.customerId,currency:customer.currencyCode??'Unavailable',timezone:customer.timeZone??'Unavailable'},limitations:['Conversions use Google Ads primary conversion actions and attribution; they are not automatically qualified leads or booked jobs.','The reporting buffer reduces recent-data bias but does not guarantee that all conversions have arrived.'],rows:mapped};
}
export async function fetchPerformance(client,kind,settings,range){
 let args;
 if(schemas[kind]){if(!/^accounts\/\d+$/.test(settings.accountId??'')||!/^properties\/\d+$/.test(settings.propertyId??''))throw new Error('Set this brand’s GA4 account and property IDs in Connections.');args={selected_api:'GoogleAnalytics4CLIAPI',action:'runReport',tool_name:'google_analytics_4_run_report_for_a_property',params:{accountId:settings.accountId,propertyId:settings.propertyId,...schemas[kind],startDate:range.previousStart,endDate:range.end,dateName:'performance',limit:10000,offset:0}};}
 else if(kind==='paid'){
  if(!/^\d{10}$/.test(settings.customerId??'')||!/^\d{10}$/.test(settings.managerId??''))throw new Error('Set this brand’s Google Ads customer and manager IDs in Connections.');
  args={selected_api:'GoogleAdsCLIAPI',action:'_zap_raw_request',tool_name:'google_ads_make_api_mutating_request',params:{method:'POST',url:'https://googleads.googleapis.com/v25/customers/'+settings.customerId+'/googleAds:search',headers:{'login-customer-id':settings.managerId,'content-type':'application/json'},body:JSON.stringify({query:"SELECT segments.date, campaign.id, campaign.name, campaign.advertising_channel_type, customer.currency_code, customer.time_zone, customer.descriptive_name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '"+range.previousStart+"' AND '"+range.end+"' LIMIT 10000"}),fail_on_errors:false}};
 }else throw new Error('Unsupported performance report.');
 const schema=await client.inspect({tool_name:args.tool_name,params:args.params});if(!Array.isArray(schema)||!schema.some(app=>app.actions?.some(action=>action.tool_name===args.tool_name)))throw new Error('Enable the Google reporting action on this brand’s Zapier server.');
 return normalizePerformance(kind,await client.execute(args),settings,range,{tool:args.tool_name,parameters:args.params});
}
