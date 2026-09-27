import {brandActor,requireAdmin,audit} from './company.mjs';
import {owner,sameOrigin,load,save,remove} from './security.mjs';
import {mcpClient,fetchReport} from './zapier-mcp.mjs';
const headers={'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const settings=env=>({accountId:env.ZAPIER_GA4_ACCOUNT_ID,propertyId:env.ZAPIER_GA4_PROPERTY_ID,propertyName:env.ZAPIER_GA4_PROPERTY_NAME,managerId:env.ZAPIER_ADS_MANAGER_ID,customerId:env.ZAPIER_ADS_CUSTOMER_ID});
export async function zapierApi(request,env){
 let user,actor;try{actor=await brandActor(request,env);user=actor.subject;}catch(error){return json({error:error.message},error.status??401);}
 try{
  if(!env.BUCKET||!env.CONNECTION_ENCRYPTION_KEY)throw new Error('Live report storage is not configured.');
  const path=new URL(request.url).pathname;
  if(request.method==='POST')sameOrigin(request,env);
  const connection=await load(env,user,'zapier');
  const reportSettings=connection?.settings??(actor.brandId===actor.company?settings(env):{});
  if(path==='/api/zapier/status'&&request.method==='GET')return json({configured:Boolean(connection?.token),canAdmin:actor.canAdmin,settings:reportSettings,reports:{ga4:await load(env,user,'zapier-ga4','report'),ads:await load(env,user,'zapier-ads','report')},attempts:{ga4:await load(env,user,'zapier-ga4','attempt'),ads:await load(env,user,'zapier-ads','attempt')}});
  if(path==='/api/zapier/configure'&&request.method==='POST'){
   requireAdmin(actor);
   const text=await request.text();if(text.length>5000)throw new Error('Connection token is too long.');const {token,settings:input}=JSON.parse(text);if(typeof token!=='string'||token.trim().length<20||token.length>4096||/\s/.test(token.trim())||token.includes('://'))throw new Error('Paste only the Zapier connection token, not a URL.');
   const nextSettings=input??reportSettings;
   if(!/^accounts\/\d+$/.test(nextSettings.accountId??'')||!/^properties\/\d+$/.test(nextSettings.propertyId??'')||!/^\d{10}$/.test(nextSettings.customerId??'')||!/^\d{10}$/.test(nextSettings.managerId??''))throw new Error('Enter the GA4 account and property IDs, plus the 10-digit Google Ads customer and manager IDs.');
   const cleanSettings={accountId:nextSettings.accountId,propertyId:nextSettings.propertyId,customerId:nextSettings.customerId,managerId:nextSettings.managerId,propertyName:String(nextSettings.propertyName??'').slice(0,200)};
   const client=await mcpClient(token.trim());try{await client.inspect({selected_api:'GoogleAnalytics4CLIAPI'});}finally{await client.close();}
   await save(env,user,'zapier',{token:token.trim(),settings:cleanSettings,generation:crypto.randomUUID(),connectedAt:new Date().toISOString()});for(const s of ['zapier-ga4','zapier-ads','performance-traffic','performance-acquisition','performance-events','performance-paid']){await remove(env,user,s,'report');await remove(env,user,s,'attempt');}return json({configured:true});
  }
  if(path==='/api/zapier/disconnect'&&request.method==='POST'){requireAdmin(actor);await remove(env,user,'zapier');for(const s of ['zapier-ga4','zapier-ads','performance-traffic','performance-acquisition','performance-events','performance-paid']){await remove(env,user,s,'report');await remove(env,user,s,'attempt');}await audit(env,actor,'zapier_disconnected','company').run();return json({disconnected:true});}
  if(path==='/api/zapier/sync'&&request.method==='POST'){
   if(!connection?.token)throw new Error('Add your Zapier connection token in Connections.');
   const {source,force}=await request.json();if(!['ga4','ads'].includes(source))throw new Error('Choose Google Analytics or Google Ads.');
   const key='zapier-'+source,prior=await load(env,user,key,'report'),attempt=await load(env,user,key,'attempt');
   const cooldown=force===true?60000:15*60000;
   if(attempt&&Date.now()-Date.parse(attempt.at)<cooldown)return json({report:prior,error:attempt.error??null,cached:true,attempt});
   const at=new Date().toISOString();await save(env,user,key,{at,error:null},'attempt');
   let client;
   try{client=await mcpClient(connection.token);const report=await fetchReport(client,source,reportSettings);const latest=await load(env,user,'zapier');if(!latest||latest.token!==connection.token||latest.generation!==connection.generation)throw new Error('The connection changed during refresh. Start again.');await save(env,user,key,report,'report');await save(env,user,key,{at,error:null},'attempt');return json({report,attempt:{at,error:null}});}
   catch(error){const message=String(error.message).replaceAll(connection.token,'[redacted]');await save(env,user,key,{at,error:message},'attempt');return json({report:prior,error:message,attempt:{at,error:message}},502);}
   finally{await client?.close();}
  }
  return json({error:'Not found'},404);
 }catch(error){return json({error:String(error.message).replace(/Bearer\s+\S+/gi,'[redacted]')},error.status??400);}
}
