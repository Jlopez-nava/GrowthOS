import {brandActor} from './company.mjs';
import {load,save,storageKey,seal,sameOrigin} from './security.mjs';
import {mcpClient} from './zapier-mcp.mjs';
import {fetchPerformance,performanceRange} from './performance-reports.mjs';
const kinds=['traffic','acquisition','events','paid'];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function performanceApi(request,env){
 try{
  const actor=await brandActor(request,env),user=actor.subject,url=new URL(request.url);
  const workspace=await load(env,user,'workspace','company'),timezone=workspace?.profile?.timezone||'America/Los_Angeles';
  const lag=Math.max(3,Math.min(30,Number.isInteger(workspace?.performance?.lagDays)?workspace.performance.lagDays:7));
  const range=performanceRange(new Date(),timezone,lag);
  const connection=await load(env,user,'zapier');
  const settings=connection?.settings??(actor.brandId===actor.company?{accountId:env.ZAPIER_GA4_ACCOUNT_ID,propertyId:env.ZAPIER_GA4_PROPERTY_ID,propertyName:env.ZAPIER_GA4_PROPERTY_NAME,managerId:env.ZAPIER_ADS_MANAGER_ID,customerId:env.ZAPIER_ADS_CUSTOMER_ID}:{});
  if(url.pathname==='/api/performance/status'&&request.method==='GET'){
   const reports={},attempts={};await Promise.all(kinds.map(async kind=>{reports[kind]=await load(env,user,'performance-'+kind,'report');attempts[kind]=await load(env,user,'performance-'+kind,'attempt');}));
   return json({configured:Boolean(connection?.token),range,reports,attempts});
  }
  if(url.pathname!=='/api/performance/sync'||request.method!=='POST')return json({error:'Not found'},404);
  sameOrigin(request,env);if(!connection?.token)return json({error:'Connect this brand’s Zapier server in Connections.'},400);
  const {kind,force}=await request.json();if(!kinds.includes(kind))return json({error:'Choose a supported performance report.'},400);
  const key='performance-'+kind,prior=await load(env,user,key,'report');
  const attemptKey=await storageKey(user,key,'attempt'),object=await env.BUCKET.get(attemptKey),attempt=await load(env,user,key,'attempt');
  if(attempt&&(!prior||(prior.start<=range.previousStart&&prior.end>=range.end))&&Date.now()-Date.parse(attempt.at)<(force?60000:15*60000))return json({report:prior,attempt,cached:true,range});
  const at=new Date().toISOString(),context='attempt:'+user+':'+key;
  const locked=await env.BUCKET.put(attemptKey,await seal(env,{at},context),{onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}});
  if(!locked)return json({report:prior,attempt:{at,error:'Another refresh is running. Try again shortly.'},cached:true,range});
  let client;
  try{
   client=await mcpClient(connection.token);const report=await fetchPerformance(client,kind,settings,range);
   const latest=await load(env,user,'zapier');if(!latest||latest.token!==connection.token||latest.generation!==connection.generation)throw new Error('The connection changed during refresh. Start again.');
   await save(env,user,key,report,'report');await save(env,user,key,{at},'attempt');return json({report,attempt:{at},range});
  }catch(error){const message=String(error.message??'Report unavailable').replaceAll(connection.token,'[redacted]').replace(/Bearer\s+\S+/gi,'[redacted]');const latest=await load(env,user,'zapier');if(latest&&latest.token===connection.token&&latest.generation===connection.generation)await save(env,user,key,{at,error:message},'attempt');return json({report:prior,attempt:{at,error:message},range},502);}
  finally{await client?.close();}
 }catch(error){return json({error:error.message??'Performance is unavailable.'},error.status??400);}
}
