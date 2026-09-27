import {performanceApi} from './performance.mjs';
import {authorize,brandActor,requireAdmin,companyApi} from './company.mjs';
import {zapierApi} from './zapier.mjs';
import {scopes,sourceOf,b64,hash,seal,unseal,owner,sameOrigin,cookie,stateCookie,load,save,remove} from './security.mjs';
import {exchange,accessToken,accounts,report} from './providers.mjs';
const safeHeaders={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...safeHeaders,'content-type':'application/json',...extra}});
const redirect=(url,cookieValue)=>new Response(null,{status:303,headers:{...safeHeaders,location:url,...(cookieValue?{'set-cookie':cookieValue}:{})}});
export async function api(request,env){
 const url=new URL(request.url);let user,actor;
 try{actor=await brandActor(request,env);user=actor.subject;}catch(error){return json({error:error.message},error.status??401);}
 const configured=Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.CONNECTION_ENCRYPTION_KEY&&env.GOOGLE_APP_ORIGIN&&env.BUCKET);
 try{
  if(url.pathname==='/api/google/status'){
   if(!configured)return json({configured:false,connections:{}});
   const connections={};for(const source of ['ga4','ads']){const c=await load(env,user,source);connections[source]=c?{authorized:true,connectedAt:c.connectedAt,verifiedAt:c.verifiedAt??null}:null;}
   return json({configured:true,connections,canAdmin:actor.canAdmin});
  }
  if(!['/api/google/status','/api/google/report'].includes(url.pathname))requireAdmin(actor);
  if(!configured)return json({error:'Google connections are not configured on this deployment.'},503);
  if(request.method==='POST')sameOrigin(request,env);
  if(url.pathname==='/api/google/oauth/start'&&request.method==='POST'){
   const form=await request.formData(),source=sourceOf(form.get('source'));
   const nonce=b64(crypto.getRandomValues(new Uint8Array(32))),verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
   const state=await seal(env,{user:actor.user,brandId:actor.brandId,source,nonce,verifier,expires:Date.now()+600000},'oauth-state');
   const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');auth.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.GOOGLE_APP_ORIGIN+'/api/google/oauth/callback',response_type:'code',scope:scopes[source],state:nonce,access_type:'offline',prompt:'consent',code_challenge:await hash(verifier),code_challenge_method:'S256'}).toString();
   return redirect(auth.toString(),stateCookie(state));
  }
  if(url.pathname==='/api/google/oauth/callback'&&request.method==='GET'){
   let state;try{state=await unseal(env,cookie(request,'__Host-google-state')??'','oauth-state');}catch{throw new Error('Google sign-in state was lost. Start again from Connections.');}
   if(state.user!==actor.user||state.expires<Date.now()||state.nonce!==url.searchParams.get('state'))throw new Error('Google sign-in verification failed. Start again from Connections.');
   actor=await brandActor(request,env,state.brandId??actor.company);user=actor.subject;
   const source=sourceOf(state.source);
   if(url.searchParams.has('error'))return redirect(env.GOOGLE_APP_ORIGIN+'/?google=cancelled#connections',stateCookie('',0));
   const code=url.searchParams.get('code');if(!code)throw new Error('Google did not return an authorization code.');
   const tokens=await exchange(env,{code,code_verifier:state.verifier,grant_type:'authorization_code',redirect_uri:env.GOOGLE_APP_ORIGIN+'/api/google/oauth/callback'});
   if(!tokens.access_token||!tokens.refresh_token)throw new Error('Google did not grant offline access. Reconnect and approve the requested source.');
   if(!tokens.scope?.split(' ').includes(scopes[source]))throw new Error('The requested Google permission was not granted.');
   await save(env,user,source,{accessToken:tokens.access_token,refreshToken:tokens.refresh_token,expiresAt:Date.now()+tokens.expires_in*1000,connectedAt:new Date().toISOString()});
   return redirect(env.GOOGLE_APP_ORIGIN+'/?google=authorized&brand='+encodeURIComponent(actor.brandId)+'#connections',stateCookie('',0));
  }
  const source=sourceOf(url.searchParams.get('source'));
  if(url.pathname==='/api/google/accounts'&&request.method==='GET'){
   const list=await accounts(source,await accessToken(env,user,source));
   const connection=await load(env,user,source);await save(env,user,source,{...connection,verifiedAt:new Date().toISOString()});
   return json({accounts:list});
  }
  if(url.pathname==='/api/google/report'&&request.method==='GET')return json({report:await load(env,user,source,'report')});
  if(url.pathname==='/api/google/sync'&&request.method==='POST'){
   const body=await request.json();const token=await accessToken(env,user,source);const list=await accounts(source,token);const account=list.find(a=>a.id===body.accountId);if(!account)throw new Error('This Google account cannot access the selected property or customer.');
   const data={...await report(source,token,account,body.start,body.end),source,start:body.start,end:body.end,collectedAt:new Date().toISOString()};
   await save(env,user,source,data,'report');const connection=await load(env,user,source);await save(env,user,source,{...connection,verifiedAt:data.collectedAt});return json({report:data});
  }
  if(url.pathname==='/api/google/disconnect'&&request.method==='POST'){
   // Remove only this app's stored connection; Google grants may be shared across sources.
   await remove(env,user,source);await remove(env,user,source,'report');return json({disconnected:true});
  }
  return json({error:'Not found'},404);
 }catch(error){const message=String(error.message??'Request failed').replace(/GOCSPX-[\w-]+/g,'[redacted]');return json({error:message},error.status??400,url.pathname.endsWith('/callback')?{'set-cookie':stateCookie('',0)}:{});}
}
export function createWorker(assets){return {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/performance/'))return performanceApi(request,env);if(url.pathname.startsWith('/api/company/'))return companyApi(request,env);if(url.pathname.startsWith('/api/zapier/'))return zapierApi(request,env);if(url.pathname.startsWith('/api/google/'))return api(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});let path=url.pathname==='/'?'/index.html':url.pathname;let asset=assets[path]??assets[path+'.html'];if(!asset)return new Response('Not found',{status:404});const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':asset.type,'cache-control':path.startsWith('/_next/')?'public, max-age=31536000, immutable':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}};}
