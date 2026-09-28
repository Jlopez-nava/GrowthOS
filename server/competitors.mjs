import {brandActor,fail} from './company.mjs';
import {load,save,storageKey,seal,unseal,sameOrigin,hash} from './security.mjs';
import {emptyResearch,mergeManual,manualCompetitor} from './competitor-core.mjs';
import {discoverCompetitors,discoveryProfile,DISCOVERY_MODEL} from './competitor-discovery.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function read(env,subject){const key=await storageKey(subject,'competitors','research'),object=await env.BUCKET.get(key);return {key,object,state:object?await unseal(env,await object.text(),'research:'+subject+':competitors'):emptyResearch()};}
async function update(env,subject,fn){
 for(let i=0;i<4;i++){const {key,object,state}=await read(env,subject),next=await fn(state);if(next===state)return state;
  next.revision=state.revision+1;const result=await env.BUCKET.put(key,await seal(env,next,'research:'+subject+':competitors'),{onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}});if(result)return next;
 }throw fail('Another teammate is updating competitors. Reload and try again.',409);
}
export async function competitorsApi(request,env){
 try{
  const actor=await brandActor(request,env),url=new URL(request.url),connection=await load(env,'company:'+actor.company,'openai-competitors');
  env={...env,OPENAI_API_KEY:connection?.token||env.OPENAI_API_KEY};
  const configured=Boolean(env.OPENAI_API_KEY),workspace=await load(env,actor.subject,'workspace','company'),profile=workspace?.profile;
  const result=state=>({research:state,configured,canScan:actor.canAdmin,model:env.COMPETITOR_MODEL||DISCOVERY_MODEL});
  if(url.pathname==='/api/competitors/status'&&request.method==='GET')return json(result((await read(env,actor.subject)).state));
  if(request.method!=='POST')return json({error:'Not found'},404);
  sameOrigin(request,env);const raw=await request.text();if(raw.length>15000)throw fail('Competitor request is too large.',413);let body;try{body=JSON.parse(raw);}catch{throw fail('Send a valid JSON request.');}if(!body||typeof body!=='object'||Array.isArray(body))throw fail('Send a valid competitor request.');
  if(url.pathname==='/api/competitors/configure'){
   if(!actor.canAdmin)throw fail('Only company admins can configure the OpenAI connection.',403);
   const token=typeof body.token==='string'?body.token.trim():'';
   if(!/^sk-[A-Za-z0-9_-]{20,500}$/.test(token))throw fail('Choose an env file containing a valid OPENAI_API_KEY.');
   let verified;try{verified=await fetch('https://api.openai.com/v1/models/'+encodeURIComponent(env.COMPETITOR_MODEL||DISCOVERY_MODEL),{headers:{authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{throw fail('OpenAI could not be reached. The key was not saved.',502);}
   if(!verified.ok)throw fail('OpenAI could not verify this key’s model access. Check the project and permissions; the key was not saved.',400);
   await save(env,'company:'+actor.company,'openai-competitors',{token,connectedAt:new Date().toISOString()});
   return json({configured:true});
  }
  if(url.pathname==='/api/competitors/sync'){
   const state=await update(env,actor.subject,s=>{const entries=mergeManual(s.entries,profile?.competitorEntries??[],profile?.website,new Date().toISOString());return entries.length===s.entries.length?s:{...s,entries};});return json(result(state));
  }
  if(url.pathname==='/api/competitors/review'){
   const state=await update(env,actor.subject,s=>{if(body.expectedRevision!==s.revision)throw fail('A teammate changed this list. Reload before reviewing again.',409);
    if(!['confirmed','dismissed','suggested'].includes(body.status))throw fail('Choose a valid review decision.');
    if(!s.entries.some(e=>e.id===body.id))throw fail('Competitor not found.',404);
    return {...s,entries:s.entries.map(e=>e.id===body.id?{...e,status:body.status,reviewedAt:new Date().toISOString()}:e)};});return json(result(state));
  }
  if(url.pathname==='/api/competitors/add'){
   const item=manualCompetitor(body,profile?.website);
   const state=await update(env,actor.subject,s=>{if(body.expectedRevision!==s.revision)throw fail('A teammate changed this list. Reload before adding again.',409);if(s.entries.some(e=>e.domain===item.domain))throw fail('That website is already in this list. Check the Confirmed or Dismissed tab.');return {...s,entries:mergeManual(s.entries,[item],profile?.website,new Date().toISOString())};});return json(result(state));
  }
  if(url.pathname!=='/api/competitors/scan')return json({error:'Not found'},404);
  if(!actor.canAdmin)throw fail('Only company admins can start paid discovery scans. You can still add and review competitors.',403);
  if(!configured)throw fail('An admin needs to configure the OpenAI API key for this website.',503);
  const clean=discoveryProfile(profile),profileHash=await hash(JSON.stringify(clean)),at=new Date().toISOString(),scanId=crypto.randomUUID();
  const state=await update(env,actor.subject,s=>{
   if(body.automatic&&(s.attempt||profile?.discoverCompetitors!==true))return s;
   if(s.attempt?.status==='running'&&Date.now()-Date.parse(s.attempt.at)<180000)throw fail('A scan is already running. Reload in a moment.',409);
   if(s.attempt&&Date.now()-Date.parse(s.attempt.at)<60000)throw fail('Wait a minute before starting another scan.',429);
   const day=at.slice(0,10),count=s.daily.date===day?s.daily.count:0;if(count>=3)throw fail('This brand has used its 3 daily scans. You can still add or review competitors. Try again tomorrow (UTC).',429);
   return {...s,daily:{date:day,count:count+1},attempt:{id:scanId,at,status:'running',profileHash,error:null}};
  });
  if(state.attempt?.id!==scanId)return json({...result(state),cached:true});
  try{
   const found=await discoverCompetitors(env,clean,state.entries.map(e=>e.domain));
   const currentProfile=(await load(env,actor.subject,'workspace','company'))?.profile;
   if(await hash(JSON.stringify(discoveryProfile(currentProfile)))!==profileHash)throw new Error('The brand profile changed during the scan. Start a new scan using the updated profile.');
   const saved=await update(env,actor.subject,s=>{if(s.attempt?.id!==scanId)throw fail('A newer scan has replaced this scan.',409);const known=new Set(s.entries.map(e=>e.domain)),additions=found.entries.filter(e=>!known.has(e.domain)).slice(0,Math.max(0,100-s.entries.length));return {...s,entries:[...s.entries,...additions],attempt:{...s.attempt,status:'complete'},lastScan:{at,completedAt:new Date().toISOString(),added:additions.length,filtered:found.filtered,limitations:found.limitations,model:found.model,usage:found.usage,profile:clean}};});return json(result(saved));
  }catch(error){const message=String(error.message??'Scan unavailable').replaceAll(env.OPENAI_API_KEY,'[redacted]');const saved=await update(env,actor.subject,s=>s.attempt?.id===scanId?{...s,attempt:{...s.attempt,status:'failed',error:message}}:s);return json({...result(saved),error:message},502);}
 }catch(error){return json({error:String(error.message??'Competitor request failed').replaceAll(env.OPENAI_API_KEY||'\u0000','[redacted]')},error.status??400);}
}
