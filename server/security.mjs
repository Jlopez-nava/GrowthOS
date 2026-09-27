const encoder = new TextEncoder();
export const scopes={ga4:'https://www.googleapis.com/auth/analytics.readonly',ads:'https://www.googleapis.com/auth/adwords'};
export function sourceOf(value){if(!Object.hasOwn(scopes,value))throw new Error('Choose Google Analytics or Google Ads.');return value;}
export function b64(bytes){return btoa(Array.from({length:Math.ceil(bytes.length/8192)},(_,i)=>String.fromCharCode(...bytes.subarray(i*8192,(i+1)*8192))).join('')).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function unb64(value){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
export async function hash(value){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
async function key(env){if(!/^[0-9a-f]{64}$/.test(env.CONNECTION_ENCRYPTION_KEY??''))throw new Error('Connection storage is not configured.');return crypto.subtle.importKey('raw',Uint8Array.from(env.CONNECTION_ENCRYPTION_KEY.match(/../g),v=>parseInt(v,16)),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(env,value,context){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)},await key(env),encoder.encode(JSON.stringify(value)));return b64(iv)+'.'+b64(new Uint8Array(data));}
export async function unseal(env,value,context){const [iv,data]=value.split('.');return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:encoder.encode(context)},await key(env),unb64(data))));}
export function owner(request,env){const user=request.headers.get('oai-authenticated-user-id');const email=request.headers.get('oai-authenticated-user-email');if(!user||!env.GOOGLE_OWNER_EMAIL||email?.toLowerCase()!==env.GOOGLE_OWNER_EMAIL.toLowerCase())throw new Error('Sign in as the Site owner to manage Google connections.');return user;}
export function sameOrigin(request,env){if(request.headers.get('origin')!==env.GOOGLE_APP_ORIGIN)throw new Error('This action must be started from your workbench.');}
export function cookie(request,name){return (request.headers.get('cookie')??'').split(';').map(c=>c.trim()).find(c=>c.startsWith(name+'='))?.slice(name.length+1);}
export function stateCookie(value,maxAge=600){return `__Host-google-state=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;}
export async function storageKey(user,source,kind='connection'){return `${kind}/${await hash(user)}/${source}`;}
export async function load(env,user,source,kind='connection'){const obj=await env.BUCKET.get(await storageKey(user,source,kind));return obj?unseal(env,await obj.text(),`${kind}:${user}:${source}`):null;}
export async function save(env,user,source,value,kind='connection'){await env.BUCKET.put(await storageKey(user,source,kind),await seal(env,value,`${kind}:${user}:${source}`),{httpMetadata:{contentType:'application/octet-stream'}});}
export async function remove(env,user,source,kind='connection'){await env.BUCKET.delete(await storageKey(user,source,kind));}
