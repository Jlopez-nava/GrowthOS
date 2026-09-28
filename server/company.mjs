import {validateActions} from './action-validation.mjs';
import {load,save,remove,seal,unseal,storageKey,sameOrigin} from './security.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
export function fail(message,status=400){return Object.assign(new Error(message),{status});}
export async function authorize(request,env){
 const user=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
 if(!user||!email)throw fail('Sign in to your company site.',401);
 if(!env.COMPANY_ID||!env.GOOGLE_OWNER_EMAIL||!env.DB||!env.BUCKET)throw fail('Company access is not configured.',503);
 const role=email===env.GOOGLE_OWNER_EMAIL.toLowerCase()?'owner':(await env.DB.prepare('SELECT role FROM company_members WHERE company_id = ? AND email = ?').bind(env.COMPANY_ID,email).first())?.role;
 if(!['owner','admin','member'].includes(role))throw fail('Your account has not been added to this company. Ask an admin for access.',403);
 return {user,email,role,canAdmin:role!=='member',company:env.COMPANY_ID,subject:'company:'+env.COMPANY_ID};
}
// The existing company namespace is the first brand, preserving saved credentials and reports.
export async function brandActor(request,env,brandId){
 const actor=await authorize(request,env),id=brandId??new URL(request.url).searchParams.get('brand')??actor.company;
 if(id===actor.company)return {...actor,brandId:id};
 if(typeof id!=='string'||!/^brand_[a-f0-9-]{36}$/.test(id))throw fail('Brand not found.',404);
 const brand=await env.DB.prepare('SELECT id,name,website FROM company_brands WHERE company_id = ? AND id = ?').bind(actor.company,id).first();
 if(!brand)throw fail('Brand not found.',404);
 return {...actor,brandId:id,brand,subject:actor.subject+':brand:'+id};
}
export function requireAdmin(actor){if(!actor.canAdmin)throw fail('Only company admins can manage connections and team access.',403);}
export function audit(env,actor,action,target){return env.DB.prepare('INSERT INTO company_audit (id,company_id,actor,action,target,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.company,actor.email,action,target,new Date().toISOString());}
export async function migrateOwner(env,actor){
 if(actor.role!=='owner'||await load(env,actor.subject,'owner-migrated','system'))return;
 for(const source of ['ga4','ads','zapier','zapier-ga4','zapier-ads'])for(const kind of ['connection','report','attempt']){
  const old=await load(env,actor.user,source,kind);if(old){if(!await load(env,actor.subject,source,kind))await save(env,actor.subject,source,old,kind);await remove(env,actor.user,source,kind);}
 }
 await save(env,actor.subject,'owner-migrated',{at:new Date().toISOString()},'system');
}
const fields=['imports','metrics','recommendations','drafts','decisions','measurements','brandVersions'];
export async function companyApi(request,env){
 try{
  let actor=await authorize(request,env);const path=new URL(request.url).pathname;
  if(request.method==='POST')sameOrigin(request,env);
  if(path==='/api/company/me'&&request.method==='GET')return json({email:actor.email,role:actor.role,canAdmin:actor.canAdmin,companyId:actor.company});
  if(path==='/api/company/migrate'&&request.method==='POST'){if(actor.role!=='owner')throw fail('Only the site owner can migrate the original connection.',403);await migrateOwner(env,actor);return json({ok:true});}
  if(path==='/api/company/team'){
   requireAdmin(actor);
   if(request.method==='GET'){const members=await env.DB.prepare('SELECT email,role,updated_at FROM company_members WHERE company_id = ? ORDER BY email').bind(actor.company).all();const recent=await env.DB.prepare('SELECT actor,action,target,created_at FROM company_audit WHERE company_id = ? ORDER BY created_at DESC LIMIT 30').bind(actor.company).all();return json({members:[{email:env.GOOGLE_OWNER_EMAIL,role:'owner'},...members.results],activity:recent.results});}
   if(request.method==='POST'){
    const {email:input,role,remove:deleteMember}=await request.json(),email=typeof input==='string'?input.trim().toLowerCase():'';
    if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('Enter a valid teammate email.');
    if(email===env.GOOGLE_OWNER_EMAIL.toLowerCase())throw fail('The site owner cannot be removed or demoted.');
    if(email===actor.email)throw fail('Ask another admin to change your own role.');
    if(!deleteMember&&!['admin','member'].includes(role))throw fail('Choose Admin or Member.');
    const mutation=deleteMember?env.DB.prepare('DELETE FROM company_members WHERE company_id = ? AND email = ?').bind(actor.company,email):env.DB.prepare('INSERT INTO company_members (company_id,email,role,added_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(company_id,email) DO UPDATE SET role=excluded.role,added_by=excluded.added_by,updated_at=excluded.updated_at').bind(actor.company,email,role,actor.email,new Date().toISOString());
    await env.DB.batch([mutation,audit(env,actor,deleteMember?'member_removed':'role_set:'+role,email)]);return json({ok:true,siteAccessRequired:!deleteMember});
   }
  }
  if(path==='/api/company/brands'){
   if(request.method==='GET'){
    const workspace=await load(env,actor.subject,'workspace','company');
    const rows=await env.DB.prepare('SELECT id,name,website FROM company_brands WHERE company_id = ? ORDER BY created_at,id').bind(actor.company).all();
    return json({brands:[{id:actor.company,name:workspace?.profile?.name||env.ZAPIER_GA4_PROPERTY_NAME||'Your brand',website:workspace?.profile?.website||'',primary:true},...rows.results]});
   }
   if(request.method==='POST'){
    requireAdmin(actor);const body=await request.json(),name=typeof body.name==='string'?body.name.trim():'',website=typeof body.website==='string'?body.website.trim():'';
    if(!name||name.length>100)throw fail('Enter a brand name of up to 100 characters.');
    let parsed;try{parsed=new URL(website);}catch{throw fail('Enter the brand’s full website address.');}
    if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw fail('Enter a valid website address.');
    const existing=await env.DB.prepare('SELECT id FROM company_brands WHERE company_id = ? AND lower(name) = lower(?)').bind(actor.company,name).first();
    if(existing)throw fail('A brand with this name already exists.');
    const brand={id:'brand_'+crypto.randomUUID(),name,website};
    await env.DB.batch([env.DB.prepare('INSERT INTO company_brands (id,company_id,name,website,created_at) VALUES (?,?,?,?,?)').bind(brand.id,actor.company,name,website,new Date().toISOString()),audit(env,actor,'brand_created',brand.id)]);
    return json({brand},201);
   }
  }
  if(path==='/api/company/workspace'){
   actor=await brandActor(request,env);
   const key=await storageKey(actor.subject,'workspace','company'),object=await env.BUCKET.get(key),context=`company:${actor.subject}:workspace`,current=object?await unseal(env,await object.text(),context):null;
   if(request.method==='GET')return json({workspace:current});
   if(request.method==='POST'){
    const text=await request.text();if(new TextEncoder().encode(text).length>10_000_000)throw fail('The shared workspace exceeds the 10 MB limit.',413);
    const data=JSON.parse(text),state=data.workspace;
    if(!state||state.mode!=='company'||state.id!==actor.brandId||!Number.isSafeInteger(data.expectedRevision))throw fail('Invalid company workspace.');
    if(data.expectedRevision!==(current?.revision??-1))throw fail('A teammate saved a newer version. Your changes have not been saved. Reload the company workspace before trying again.',409);
    if(!current)requireAdmin(actor);
    if(!state.profile||typeof state.profile.name!=='string'||!state.profile.name.trim()||!state.rules||fields.some(f=>!Array.isArray(state[f])))throw fail('The shared workspace is incomplete.');
    validateActions(state.actionPlans,actor.brandId);
    const next={...state,id:actor.brandId,mode:'company',revision:(current?.revision??-1)+1,updatedAt:new Date().toISOString(),updatedBy:actor.email};
    const saved=await env.BUCKET.put(key,await seal(env,next,context),{onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}});
    if(!saved)throw fail('A teammate just saved changes. Reload the company workspace before trying again.',409);
    if(actor.brand)await env.DB.prepare('UPDATE company_brands SET name = ?, website = ? WHERE company_id = ? AND id = ?').bind(next.profile.name,next.profile.website,actor.company,actor.brandId).run();
    return json({workspace:next});
   }
  }
  return json({error:'Not found'},404);
 }catch(error){return json({error:error.message??'Company request failed.'},error.status??400);}
}
